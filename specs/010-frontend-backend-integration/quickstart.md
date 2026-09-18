# Quickstart — Happy Path

**Feature**: Frontend-Backend Integration (`specs/010-frontend-backend-integration/spec.md`)

A run-through to check the feature by hand. Takes about 5 minutes.

## 0. Start everything

```bash
cd docker
printf 'POSTGRES_PASSWORD=devops123\nSECRET_KEY=super-secret-dev-key-1234567890123456\n' > .env.dev
printf 'devops123\n' > pg_password.txt
docker compose -p misiops up --build -d postgres backend
```

Both files are gitignored and use the same values as the CI workflow. Confirm the API is up:

```bash
curl http://localhost:8000/
```

Expected: `{"status":"ok"}`

Then the frontend:

```bash
cd frontend
cp .env.example .env.local
pnpm install
pnpm dev
```

Open <http://localhost:3000>.

## 1. You are not let in without an account

Open <http://localhost:3000> directly.

✅ You land on **Entra a MisiOps**, and the left nav shows no sections — there is nothing to browse while signed out.

## 2. Create an account

Click **Crea una**, fill in name, e-mail and a password of 8+ characters, then **Crear cuenta**.

✅ You land on **Resumen**, the nav appears, and the period reads "Del 1 de setiembre al 30 de setiembre" — that range is computed by the server from your `budget_start_day`, not by the browser.

## 3. The categories came from the server

Go to **Categorías**.

✅ You already have Spanish categories (Comida, Compras, Entretenimiento, Otros, Salud, Transporte, Vivienda / Sueldo, Otros). The frontend seeds nothing: these were created by the backend when your account was registered.

## 4. Record movements

**Movimientos → Nuevo movimiento**, then record three:

| Tipo | Monto | Categoría | Detalle |
| --- | --- | --- | --- |
| Ingreso | 3200 | Sueldo | Sueldo de setiembre |
| Gasto | 890 | Vivienda | Alquiler del depa |
| Gasto | 124.40 | Comida | Mercado de la semana |

✅ Each one confirms with "Movimiento registrado." and the form clears, ready for the next.

## 5. The numbers add up, and the server computed them

Go to **Resumen**.

✅ Entró **S/ 3,200.00**, Salió **S/ 1,014.40**, and the headline reads **S/ 2,185.60** (3200 − 1014.40). "Tope mensual: sin tope" because your limit is 0, which the API reports as `remaining_budget: null`.
✅ The breakdown shows Vivienda 88% and Comida 12%.

Nothing on this screen is calculated in the browser — it all comes from `GET /api/v1/transactions/summary`.

## 6. Prove it is really in the database

```bash
cd docker
docker compose -p misiops exec postgres psql -U myuser -d mydb -c \
  "SELECT t.id, t.amount, t.type, t.source, t.description, c.name AS categoria, u.email
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     JOIN users u ON u.id = t.user_id
    ORDER BY t.id;"
```

✅ The three rows are there with your e-mail, and `source = manual` — a value the server assigns, never the client.

## 7. Prove it is not in your browser

Open the browser console:

```js
Object.keys(localStorage)
```

✅ Only `misiops.token.v1`. No categories, no transactions, no `misiops.ledger.v1`. The browser holds a credential and nothing else.

## 8. Prove it follows you, not the browser

In the console:

```js
localStorage.clear(); location.reload()
```

✅ You are back at the login screen. Sign in again with the same account.
✅ Every number returns exactly as it was — because it was never in this browser to begin with.

## 9. Filters and paging are server-side

**Movimientos** → set **Solo gastos**.

✅ Only the two expenses remain. The request sent is `GET /api/v1/transactions?type=expense`; the browser does not filter a local list. You can watch it in the Network tab.

## 10. A busy category cannot be deleted

**Categorías** → delete **Vivienda** → confirm.

✅ It is refused with the server's own message naming how many transactions block it, and the category stays.

## 11. Failures look like failures

Stop the backend and reload any screen:

```bash
cd docker && docker compose -p misiops stop backend
```

✅ You get "No pudimos conectarnos al servidor…" with a **Reintentar** button — never an empty screen implying your data vanished.

Bring it back and press **Reintentar**:

```bash
docker compose -p misiops start backend
```

✅ The data returns without reloading the page.

## 12. Nobody sees anybody else's money

Sign out, create a second account with a different e-mail.

✅ Its dashboard is at zero and its history is empty. The first account's movements are nowhere to be seen.

To check it at the API level, with a second account's token:

```bash
curl -X PATCH http://localhost:8000/api/v1/transactions/1 \
  -H "Authorization: Bearer <second account token>" \
  -H "Content-Type: application/json" -d '{"amount":1}'
```

✅ `{"detail":"Transaction not found"}` with HTTP 404 — identical to a row that does not exist, so nothing leaks about who owns what.

## Teardown

```bash
cd docker && docker compose -p misiops down
```

Add `-v` to drop the database volume as well and start from an empty database next time.
