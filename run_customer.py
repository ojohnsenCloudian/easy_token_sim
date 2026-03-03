#!/usr/bin/env python3
"""
Bridge script that resolves relative file paths in customer_info.yaml
and invokes simulate_add_node.py with full absolute paths.

Usage: python3 run_customer.py <folder_name> <run_id> <output_dir>
  folder_name  - customer folder name, e.g. move-03-03-2026
  run_id       - unique run identifier (used for per-run output isolation)
  output_dir   - absolute path to write output files to
"""

import sys
import os
import yaml
import tempfile

DATA_DIR = os.environ.get("DATA_DIR", "/data")
CUSTOMERS_DIR = os.path.join(DATA_DIR, "customers")
SIMULATOR_DIR = os.path.dirname(os.path.abspath(__file__))
SIMULATE_SCRIPT = os.path.join(SIMULATOR_DIR, "expansion-simulator", "simulate_add_node.py")


def resolve(value: str, base_dir: str) -> str:
    """Resolve a path: if relative, prefix with base_dir; if absolute, leave as-is."""
    if not value:
        return value
    if os.path.isabs(value):
        return value
    return os.path.join(base_dir, value)


def main():
    if len(sys.argv) < 4:
        print("Usage: run_customer.py <folder_name> <run_id> <output_dir>", file=sys.stderr)
        sys.exit(1)

    folder_name = sys.argv[1]
    run_id = sys.argv[2]
    output_dir = sys.argv[3]

    customer_dir = os.path.join(CUSTOMERS_DIR, folder_name)
    yaml_path = os.path.join(customer_dir, "customer_info.yaml")
    logs_dir = os.path.join(customer_dir, "logs")

    if not os.path.exists(yaml_path):
        print(f"ERROR: Config file not found: {yaml_path}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(logs_dir, exist_ok=True)

    # Read and resolve paths in YAML
    with open(yaml_path) as f:
        docs = list(yaml.load_all(f, Loader=yaml.FullLoader))

    resolved_docs = []
    for doc in docs:
        if not isinstance(doc, dict):
            resolved_docs.append(doc)
            continue

        d = dict(doc)
        for key in ("hss_ring_output", "hss_status_output"):
            if key in d and d[key]:
                d[key] = resolve(str(d[key]).strip(), customer_dir)

        # Always set output_dir to the per-run output directory
        d["output_dir"] = output_dir

        resolved_docs.append(d)

    # Write resolved YAML to a temp file
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".yaml", delete=False, prefix=f"run_{run_id}_"
    ) as tmp:
        yaml.dump_all(resolved_docs, tmp, default_flow_style=False, allow_unicode=True)
        tmp_path = tmp.name

    print(f"[run_customer] Customer dir : {customer_dir}")
    print(f"[run_customer] Output dir   : {output_dir}")
    print(f"[run_customer] Logs dir     : {logs_dir}")
    print(f"[run_customer] Config       : {tmp_path}")
    print(f"[run_customer] Simulator    : {SIMULATE_SCRIPT}")
    print()
    sys.stdout.flush()

    # Change to expansion-simulator dir so relative paths in bash scripts work
    sim_dir = os.path.join(SIMULATOR_DIR, "expansion-simulator")
    os.chdir(sim_dir)

    # Pass the log path as a system property for log4j
    os.environ["LOG_FILE_PATH"] = os.path.join(logs_dir, "cloudian-token.log")

    # Hand off to simulate_add_node.py (replaces this process)
    os.execv(sys.executable, [sys.executable, SIMULATE_SCRIPT, tmp_path])


if __name__ == "__main__":
    main()
