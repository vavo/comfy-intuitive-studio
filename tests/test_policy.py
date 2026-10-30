import importlib
import json
import sqlite3
import sys
import tempfile
import types
import unittest
from unittest.mock import patch
from pathlib import Path

root = Path(__file__).resolve().parents[1]
package = types.ModuleType("studio")
package.__path__ = [str(root)]
sys.modules["studio"] = package
policy = importlib.import_module("studio.policy")
budget = importlib.import_module("studio.budget")


def request(**changes):
    return json.dumps({"model": "black-forest-labs-flux-1-schnell", "workflow": "text-to-image",
                       "values": {"prompt": "A glass bottle", "width": 512, "height": 512},
                       "session": "c52b79c3-a0f2-47ea-b19c-4e6148726870", "run": 1, "cap": 10, **changes})


class PolicyTests(unittest.TestCase):
    def test_all_workflow_types_preserved(self):
        self.assertEqual(len(policy.catalog()["workflows"]), 10)

    def test_valid_request(self):
        _, options, _ = policy.validate(request(), "image")
        self.assertEqual(options["inputs"]["width"], 512)

    def test_closed_model_rejected_even_via_raw_json(self):
        with self.assertRaisesRegex(policy.FormaError, "verified"):
            policy.validate(request(model="seedream-v4-t2i"))

    def test_fal_model_rejected_despite_open_weights(self):
        with self.assertRaises(policy.FormaError):
            policy.validate(request(model="fal-flux-2-klein-9b"))

    def test_unavailable_and_wrong_kind_rejected(self):
        for raw, kind in [(request(workflow="motion-transfer"), None), (request(), "video")]:
            with self.assertRaises(policy.FormaError):
                policy.validate(raw, kind)

    def test_unsupported_wan_duration_fails_before_submission(self):
        with self.assertRaisesRegex(policy.FormaError, "duration"):
            policy.validate(request(model="wan-2-2-i2v-720", workflow="image-to-video", values={"prompt":"camera movement", "image":"https://example.com/image.png", "duration":3}))

    def test_unreviewed_lora_and_prompt_enhancer_rejected(self):
        for field in ["loras", "enable_prompt_optimization"]:
            with self.assertRaises(policy.FormaError):
                policy.validate(request(values={"prompt": "test", field: True}))

    def test_invalid_request_shapes(self):
        for raw in ["[]", "null", "x", request(cap=-1), request(cap=True), request(run=0), request(session="bad"), request(values={"prompt":"x", "width": float("nan")})]:
            with self.assertRaises(policy.FormaError):
                policy.validate(raw)

    def test_budget_durable_and_idempotent(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "budget.db"
            budget.reserve(path, "first", 200, 300)
            budget.reserve(path, "first", 200, 300)
            with self.assertRaisesRegex(policy.FormaError, "budget"):
                budget.reserve(path, "second", 101, 300)
            with sqlite3.connect(path) as db:
                self.assertEqual(db.execute("SELECT SUM(cents) FROM spend").fetchone()[0], 200)

    def test_changed_recovery_quote_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "budget.db"
            budget.reserve(path, "first", 10, 300)
            with self.assertRaises(policy.FormaError):
                budget.reserve(path, "first", 20, 300)

    def test_budget_blocks_network_submission_and_keeps_uncertain_charge(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "budget.db"
            client = budget.BudgetClient.__new__(budget.BudgetClient)
            client.quotes = {"quote": {"requestId": "one", "cents": 200}}
            with patch.object(budget, "budget_path", return_value=path), patch.dict("os.environ", {"STUDIO_BUDGET_CENTS": "300"}):
                with patch.object(budget.FormaClient, "request", side_effect=policy.FormaError("Connection lost")):
                    with self.assertRaises(policy.FormaError):
                        client.request("/jobs", {"quoteId": "quote"})
                client.quotes["quote"] = {"requestId": "two", "cents": 101}
                with patch.object(budget.FormaClient, "request") as network:
                    with self.assertRaisesRegex(policy.FormaError, "budget"):
                        client.request("/jobs", {"quoteId": "quote"})
                    network.assert_not_called()
            with sqlite3.connect(path) as db:
                self.assertEqual(db.execute("SELECT cents,status FROM spend").fetchall(), [(200, "RESERVED")])

    def test_recovering_existing_job_without_prior_local_purchase(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "budget.db"
            client = budget.BudgetClient.__new__(budget.BudgetClient)
            with patch.object(budget, "budget_path", return_value=path), patch.object(budget.FormaClient, "request", return_value={"job": {"id": "old", "status": "COMPLETED"}}):
                self.assertEqual(client.request("/jobs/old")["job"]["status"], "COMPLETED")
            with sqlite3.connect(path) as db:
                self.assertEqual(db.execute("SELECT COUNT(*) FROM spend").fetchone()[0], 0)


if __name__ == "__main__":
    unittest.main()
