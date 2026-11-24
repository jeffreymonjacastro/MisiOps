#!/usr/bin/env bash
set -euo pipefail
outputs=$(aws cloudformation describe-stacks --stack-name "MisiOps-$MONITOR_ENV" \
  --query 'Stacks[0].Outputs' --output json)
get() { jq -er --arg key "$1" '.[] | select(.OutputKey == $key) | .OutputValue' <<< "$outputs"; }
cluster=$(get ClusterName)
task_def=$(get ForecastMonitorTaskArn)
network=$(get ForecastMonitorNetwork)
log_group=$(get ForecastMonitorLogGroup)
launch=$(aws ecs run-task --cluster "$cluster" --task-definition "$task_def" \
  --launch-type FARGATE --network-configuration "$network")
task=$(jq -er '.tasks[0].taskArn' <<< "$launch")
aws ecs wait tasks-stopped --cluster "$cluster" --tasks "$task"
exit_code=$(aws ecs describe-tasks --cluster "$cluster" --tasks "$task" \
  --query 'tasks[0].containers[0].exitCode' --output text)
test "$exit_code" = 0
stream="monitor/forecast-monitor/${task##*/}"
for _ in {1..8}; do
  raw=$(aws logs filter-log-events --log-group-name "$log_group" --log-stream-names "$stream" \
    --output json)
  found=$(jq -c '.events[].message | fromjson? | select(.event == "forecast_monitor")' <<< "$raw")
  if [[ -n "$found" ]]; then break; fi
  sleep 5
done
test -n "$found"
printf '%s\n' "$found" > forecast-monitor.json
jq . forecast-monitor.json >> "$GITHUB_STEP_SUMMARY"
if jq -e '.labels_finalized > 0 and any(.by_cutoff[]; .decision == "retrain_candidate")' \
  forecast-monitor.json >/dev/null; then
  echo 'retrain=true' >> "$GITHUB_OUTPUT"
fi
