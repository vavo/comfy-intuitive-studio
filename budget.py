"""Durable conservative inference ceiling, including uncertain submissions."""
import json
import os
import sqlite3
from pathlib import Path
from .vendor.client import FormaClient, FormaError


def budget_path():
    import folder_paths
    root = Path(folder_paths.get_user_directory()).resolve().parent / ".intuitive-studio"
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    return root / "spend.sqlite3"


def reserve(path, request_id, cents, ceiling):
    if type(cents) is not int or cents < 0:
        raise FormaError("Forma returned an invalid quote amount.")
    with sqlite3.connect(path, timeout=10) as db:
        db.execute("CREATE TABLE IF NOT EXISTS spend (request_id TEXT PRIMARY KEY, cents INTEGER NOT NULL, job_id TEXT, status TEXT NOT NULL)")
        db.execute("BEGIN IMMEDIATE")
        previous = db.execute("SELECT cents FROM spend WHERE request_id=?", (request_id,)).fetchone()
        if previous:
            if previous[0] != cents:
                raise FormaError("Recovery quote changed. Review the prior reservation before retrying.")
            return
        total = db.execute("SELECT COALESCE(SUM(cents),0) FROM spend").fetchone()[0]
        if total + cents > ceiling:
            raise FormaError(f"Prototype budget reached: {total} cents reserved/spent of {ceiling}. No job submitted.")
        db.execute("INSERT INTO spend VALUES (?, ?, NULL, 'RESERVED')", (request_id, cents))


class BudgetClient(FormaClient):
    def __init__(self):
        super().__init__()
        if self.base != "https://forma.cam/api/v1":
            raise FormaError("This prototype is restricted to the Forma production API.")
        self.quotes = {}

    def request(self, path, body=None, **kwargs):
        if path == "/jobs" and body:
            quote = self.quotes.get(body.get("quoteId"))
            if not quote:
                raise FormaError("A fresh validated quote is required before submission.")
            reserve(budget_path(), quote["requestId"], quote["cents"], int(os.environ.get("STUDIO_BUDGET_CENTS", "300")))
        result = super().request(path, body, **kwargs)
        if path == "/quotes":
            self.quotes[result["quote"]["id"]] = {**result["quote"], "requestId": body["requestId"]}
        elif path == "/jobs" and body:
            quote = self.quotes[body["quoteId"]]
            with sqlite3.connect(budget_path()) as db:
                db.execute("UPDATE spend SET job_id=?,status=? WHERE request_id=?", (result["job"]["id"], result["job"]["status"], quote["requestId"]))
        if path.startswith("/jobs/") and "job" in result:
            with sqlite3.connect(budget_path()) as db:
                db.execute("UPDATE spend SET status=? WHERE job_id=?", (result["job"]["status"], result["job"]["id"]))
        return result
