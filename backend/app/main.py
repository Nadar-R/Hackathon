import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.api.v1.endpoints import router as api_v1_router
from backend.app.services.import_export_service import CSV_TEMPLATES


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Save CSV templates to templates/csv/ for developer convenience
    templates_dir = Path("templates/csv")
    templates_dir.mkdir(parents=True, exist_ok=True)
    for filename, lines in CSV_TEMPLATES.items():
        filepath = templates_dir / filename
        filepath.write_text("\n".join(lines), encoding="utf-8")
    yield


app = FastAPI(
    title="CyberSupply API",
    description="Deterministic Cyber-to-Supply-Chain Scenario Workbench",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware for local frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*",  # Local dev accessibility
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v1_router, prefix="/api/v1")


@app.get("/api/v1/health")
def health_check():
    return {
        "status": "healthy",
        "engine_version": "0.1.0",
        "binding": "127.0.0.1",
        "synthetic_default": True,
        "security_mode": "local_first_unprivileged",
    }


if __name__ == "__main__":
    import uvicorn
    # Default to 127.0.0.1 loopback per NFR-SEC-001
    host = os.environ.get("CYBERCHAIN_HOST", "127.0.0.1")
    port = int(os.environ.get("CYBERCHAIN_PORT", "8000"))
    uvicorn.run("backend.app.main:app", host=host, port=port, reload=True)
