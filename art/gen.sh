#!/bin/zsh
# 写真風の絵を1枚つくる。zsh gen.sh <名前>（prompts/<名前>.md → raw/<名前>.png）
k=$1; cd ${0:a:h}
if [[ $k == bg ]]; then s=1024x1536; else s=1536x1024; fi
python3 ~/.claude/skills/3d-homepage/scripts/codex_imagegen.py raw/$k.png prompts/$k.md --quality high --size $s > logs/$k.log 2>&1
echo "$k done $?"
