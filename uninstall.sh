#!/bin/bash
# Adaptico OS — Uninstaller (core)
# Removes the core skills/agents that src/core/ provides, derived dynamically so it
# stays in sync with the sources. Leaves any non-core skills untouched.
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo -e "${YELLOW}Uninstalling Adaptico OS...${NC}"
echo ""

INSTALL_DIR="$(pwd)"
SCRIPT_DIR="$(cd "$(dirname "$BASH_SOURCE")" && pwd)"
SRC_DIR="$SCRIPT_DIR/src/core"

SKILLS_DIR="$INSTALL_DIR/.claude/skills"
AGENTS_DIR="$INSTALL_DIR/.claude/agents"

if [ ! -d "$SRC_DIR" ]; then
    echo -e "${RED}No core sources found at $SRC_DIR${NC}"
    exit 1
fi

# Remove skills (every skill src/core/skills provides)
for skill_path in "$SRC_DIR/skills"/*/; do
    [ -d "$skill_path" ] || continue
    skill="$(basename "$skill_path")"
    if [ -d "$SKILLS_DIR/$skill" ]; then
        rm -rf "$SKILLS_DIR/$skill"
        echo -e "  ${GREEN}✓${NC} Removed skill: $skill"
    fi
done

# Remove agents (every agent src/core/agents provides)
shopt -s nullglob
for agent_file in "$SRC_DIR/agents"/*.md; do
    agent="$(basename "$agent_file")"
    if [ -f "$AGENTS_DIR/$agent" ]; then
        rm "$AGENTS_DIR/$agent"
        echo -e "  ${GREEN}✓${NC} Removed agent: $(basename "$agent" .md)"
    fi
done
shopt -u nullglob

echo ""
echo -e "${GREEN}Adaptico OS uninstalled.${NC}"
echo ""
