import base64
import re

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.claude_service import analyze_github_repo

router = APIRouter()

GITHUB_HEADERS = {
    "User-Agent": "interview-coach",
    "Accept": "application/vnd.github.v3+json",
}


class AnalyzeRepoRequest(BaseModel):
    repo_url: str


def parse_github_url(url: str) -> tuple[str, str]:
    match = re.search(r"github\.com/([^/\s]+)/([^/\s#?]+)", url)
    if not match:
        raise HTTPException(
            status_code=400,
            detail="Invalid GitHub URL. Use the format: https://github.com/owner/repo",
        )
    owner, repo = match.group(1), match.group(2).rstrip(".git")
    return owner, repo


@router.post("/profile/analyze-repo")
async def analyze_repo(body: AnalyzeRepoRequest):
    """Fetch GitHub repo data and run Claude analysis. No auth or DB writes — caller saves the result."""
    owner, repo_name = parse_github_url(body.repo_url)
    canonical_url = f"https://github.com/{owner}/{repo_name}"

    async with httpx.AsyncClient(headers=GITHUB_HEADERS, timeout=15) as client:
        import asyncio
        repo_task = client.get(f"https://api.github.com/repos/{owner}/{repo_name}")
        lang_task = client.get(f"https://api.github.com/repos/{owner}/{repo_name}/languages")
        readme_task = client.get(f"https://api.github.com/repos/{owner}/{repo_name}/readme")
        results = await asyncio.gather(repo_task, lang_task, readme_task, return_exceptions=True)

    def safe_json(r):
        if isinstance(r, Exception):
            return {}
        try:
            return r.json()
        except Exception:
            return {}

    repo_data = safe_json(results[0])
    if isinstance(results[0], httpx.Response) and results[0].status_code == 404:
        raise HTTPException(status_code=404, detail="GitHub repo not found or is private")

    languages: dict = safe_json(results[1]) if isinstance(safe_json(results[1]), dict) else {}
    readme_data = safe_json(results[2])

    readme_raw = ""
    if readme_data.get("content"):
        try:
            readme_raw = base64.b64decode(readme_data["content"]).decode("utf-8", errors="ignore")
        except Exception:
            readme_raw = ""

    breakdown = analyze_github_repo(
        repo_url=canonical_url,
        repo_name=repo_name,
        description=repo_data.get("description") or "",
        languages=languages,
        readme=readme_raw,
    )

    return {
        "repo_url": canonical_url,
        "repo_name": repo_name,
        "description": repo_data.get("description") or "",
        "languages": languages,
        "breakdown": breakdown.get("architecture_summary", ""),
        "diagram": breakdown.get("mermaid_diagram", ""),
        "talking_points": breakdown.get("talking_points", []),
    }
