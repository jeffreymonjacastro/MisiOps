import pytest

pytestmark = pytest.mark.anyio

# Headers flagged as missing by the ZAP API scan (specs/011-devsecops, FR-014).
EXPECTED = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "same-site",
}


@pytest.mark.parametrize("path", ["/", "/api/v1/user/", "/api/v1/does-not-exist"])
async def test_security_headers_on_every_response(client, path):
    r = await client.get(path)
    for name, value in EXPECTED.items():
        assert r.headers.get(name) == value, name


async def test_cors_preflight_still_works(client):
    r = await client.options(
        "/api/v1/auth/login",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"},
    )
    assert r.status_code == 200
    assert r.headers["X-Content-Type-Options"] == "nosniff"
