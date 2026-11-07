# Pipeline CI/CD de MisiOps

Imagen renderizada: [`../img/pipeline.png`](../img/pipeline.png). Fuente Mermaid abajo.

```mermaid
flowchart LR
  dev([Desarrollador]) -->|git commit| pc["pre-commit local<br/>.githooks/pre-commit<br/>gitleaks + detect-private-key"]
  pc -->|git push| pp["pre-push<br/>.githooks/pre-push<br/>artefactos SDD"]
  pp --> pr{{"Pull request<br/>feature/* → develop<br/>develop → main"}}

  subgraph QA["Calidad (existente)"]
    sdd["SDD Pipeline Enforcer<br/>sdd-enforcer.yml"]
    be["backend-ci.yml<br/>ruff · pytest · pip-audit"]
    fe["frontend-ci.yml<br/>eslint · node:test · next build"]
    it["docker-integration.yml<br/>compose up + health check"]
  end

  subgraph SEC["devsecops.yml (nuevo)"]
    build["build<br/>imágenes backend/frontend<br/>(una sola vez)"]
    sast["sast<br/>Semgrep 1.183.0"]
    sec["secrets<br/>Gitleaks 8.30.1 + TruffleHog 3.99.8<br/>(todo el historial)"]
    sca["sca<br/>Trivy 0.76.1 fs + SBOM CycloneDX"]
    cont["container<br/>Trivy image ×3"]
    iac["iac<br/>Trivy config + Semgrep compose"]
    dast["dast<br/>ZAP 2.17.0 baseline (frontend)<br/>+ API scan autenticado (OpenAPI)"]
    tst["scripts-test<br/>tests de security/"]
    sum["summary<br/>tabla por herramienta"]
    dd["defectdojo<br/>reimport-scan vía ngrok"]
    del["deliver<br/>push a GHCR<br/>(solo push a main)"]
  end

  pr --> QA
  pr --> build & sast & sec & sca & iac & tst
  build --> cont & dast
  gate{{"Gate por herramienta<br/>bloquea en PR/push a main<br/>(required checks de 'Protect main')<br/>solo reporta hacia develop (EX-001)"}}
  sast & sec & sca & cont & iac & dast & tst --> gate
  gate --> sum
  gate --> dd
  gate -->|todos verdes| del
  dd -.-> dojo[(DefectDojo<br/>producto MisiOps)]
  del --> ghcr[(ghcr.io/jeffreymonjacastro<br/>misiops-backend / misiops-frontend)]
```

| Archivo | Rol |
| --- | --- |
| `.github/workflows/devsecops.yml` | Etapas de seguridad, centralización y entrega |
| `.github/workflows/backend-ci.yml`, `frontend-ci.yml` | Lint, tests, build y `pip-audit` |
| `.github/workflows/docker-integration.yml` | Levanta el compose y verifica la API |
| `.github/workflows/sdd-enforcer.yml` | Exige los artefactos SDD en PRs `feature/*` |
| `.githooks/pre-commit`, `.pre-commit-config.yaml` | Bloqueo local de secretos |
| `.githooks/pre-push` | Bloqueo local sin artefactos SDD |
| `security/scripts/*` | Gate, filtro de Trivy, subida e importación a DefectDojo |
| `security/zap/rules.conf`, `.gitleaks.toml`, `security/trufflehog-exclude.txt`, `.trivyignore.yaml`, `.semgrepignore` | Configuración y excepciones justificadas |
