"""
Standalone STAR scoring test script.

Run from the server/ directory:
    python tests/test_scoring.py

Requires server/.env with ANTHROPIC_API_KEY set.
"""

import sys
import os

# Make sure server/ root is on the path so imports work outside uvicorn
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

from services.claude_service import score_star_response

QUESTION = "Tell me about a time you had to lead a team through a difficult project."

SAMPLES = {
    "weak": {
        "label": "Weak — vague one-liner, no specifics",
        "answer": "I once led a team and it was hard but we got through it.",
        "expected": {"situation": (1, 2), "task": (1, 2), "action": (1, 2), "result": (1, 2)},
    },
    "mediocre": {
        "label": "Mediocre — some structure, heavy 'we', no metrics",
        "answer": (
            "At my last company I led a backend team on a migration project. "
            "We ran into some issues along the way and I helped coordinate the work. "
            "It shipped eventually and the team was happy."
        ),
        "expected": {"situation": (2, 3), "task": (2, 3), "action": (2, 3), "result": (1, 2)},
    },
    "strong": {
        "label": "Strong — specific, individual 'I', quantified result",
        "answer": (
            "In Q3 2023 at Acme Corp, our 4-person backend team had 6 weeks to migrate a monolith "
            "to microservices before a contractual deadline that would cost us $200k if missed. "
            "As tech lead, I owned the migration plan and risk register end-to-end. "
            "I broke the work into 3 phases, wrote the ADRs for service boundaries to align stakeholders, "
            "ran daily 15-minute standups to surface blockers early, and personally unblocked the auth "
            "service split by pairing with the junior engineer for two days when we fell behind. "
            "We shipped on time, reduced API latency by 34%, and on-call incidents dropped 60% "
            "in the following quarter. I also wrote a post-mortem that became the migration playbook "
            "for two other teams."
        ),
        "expected": {"situation": (4, 5), "task": (4, 5), "action": (4, 5), "result": (4, 5)},
    },
    "no_result": {
        "label": "No result — strong S/T/A but vague ending",
        "answer": (
            "In Q3 2023 at Acme Corp, our 4-person backend team had 6 weeks to migrate a monolith "
            "to microservices before a contractual deadline. As tech lead I owned the migration plan "
            "and risk register. I broke the work into 3 phases, wrote ADRs for service boundaries, "
            "ran daily 15-minute standups, and personally unblocked the auth service split by pairing "
            "with the junior engineer for two days. The project went well."
        ),
        "expected": {"situation": (4, 5), "task": (4, 5), "action": (4, 5), "result": (1, 2)},
    },
}

DIMS = ["situation", "task", "action", "result"]
COL_W = 12


def check(score: int, expected: tuple[int, int]) -> str:
    return "PASS" if expected[0] <= score <= expected[1] else f"FAIL (expected {expected[0]}-{expected[1]})"


def run():
    total = 0
    passed = 0

    for key, sample in SAMPLES.items():
        print(f"\n{'=' * 70}")
        print(f"[{key.upper()}]  {sample['label']}")
        print(f"Answer: \"{sample['answer'][:80]}{'...' if len(sample['answer']) > 80 else ''}\"")
        print()

        try:
            result = score_star_response(QUESTION, sample["answer"])
        except Exception as e:
            print(f"  ERROR calling Claude: {e}")
            continue

        header = f"  {'Dim':<{COL_W}} {'Score':<8} {'Expected':<14} Status"
        print(header)
        print("  " + "-" * (len(header) - 2))

        all_pass = True
        for dim in DIMS:
            score = result[dim]
            exp = sample["expected"][dim]
            status = check(score, exp)
            if status != "PASS":
                all_pass = False
            print(f"  {dim.capitalize():<{COL_W}} {score:<8} {exp[0]}-{exp[1]:<10} {status}")

        print(f"\n  Coaching note: {result['feedback']}")

        total += 1
        if all_pass:
            passed += 1
            print("\n  Result: ALL DIMENSIONS PASS")
        else:
            print("\n  Result: ONE OR MORE DIMENSIONS OUT OF EXPECTED RANGE")

    print(f"\n{'=' * 70}")
    print(f"SUMMARY: {passed}/{total} samples fully within expected score ranges")
    print(f"{'=' * 70}\n")


if __name__ == "__main__":
    run()
