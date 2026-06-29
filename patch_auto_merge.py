import sys
with open('.github/workflows/auto-merge-jules.yml', 'r') as f:
    content = f.read()

content = content.replace('run: gh pr review "$PR_URL" --approve', 'run: gh pr review "$PR_URL" --approve || true')

with open('.github/workflows/auto-merge-jules.yml', 'w') as f:
    f.write(content)
