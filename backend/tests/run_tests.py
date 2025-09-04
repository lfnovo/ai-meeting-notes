#!/usr/bin/env python3
"""
Simple test runner script for the Entity Check-up feature tests.

Usage:
    python run_tests.py                    # Run all checkup tests
    python run_tests.py -v                 # Run with verbose output
    python run_tests.py --coverage         # Run with coverage report
"""

import subprocess
import sys
from pathlib import Path


def main():
    """Run the tests with appropriate options"""
    test_file = Path(__file__).parent / "test_checkup_endpoints.py"
    
    # Base command
    cmd = ["uv", "run", "pytest"]
    
    # Add test file
    cmd.append(str(test_file))
    
    # Parse arguments
    if "-v" in sys.argv or "--verbose" in sys.argv:
        cmd.append("-v")
    
    if "--coverage" in sys.argv:
        cmd.extend(["--cov=app", "--cov-report=term-missing"])
    
    # Add asyncio mode
    cmd.append("--asyncio-mode=auto")
    
    # Add color output
    cmd.append("--color=yes")
    
    # Run the tests
    result = subprocess.run(cmd, cwd=Path(__file__).parent.parent.parent)
    sys.exit(result.returncode)


if __name__ == "__main__":
    main()