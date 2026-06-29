import sys
with open('.github/workflows/auto-merge-jules.yml', 'r') as f:
    content = f.read()

new_content = """name: Auto-merge AI PRs

on:
  pull_request:
    types: [opened, reopened, synchronize]

permissions:
  pull-requests: write
  contents: write

jobs:
  auto-merge:
    runs-on: ubuntu-latest

    # Matches branches starting with "jules/" or "jules-"
    if: startsWith(github.head_ref, 'jules/') || startsWith(github.head_ref, 'jules-')

    steps:
      - name: Enable Auto-Merge
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          PR_URL: ${{ github.event.pull_request.html_url }}
        run: gh pr merge --auto --squash "$PR_URL"
"""

with open('.github/workflows/auto-merge-jules.yml', 'w') as f:
    f.write(new_content)
