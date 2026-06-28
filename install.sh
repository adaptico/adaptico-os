#!/bin/bash
# Adaptico OS — Claude Code Skills Installer
# Installs the free (core) go-to-market skills, agents, and scripts into .claude/ in the working directory.
# Sources live under src/core/. Skills and agents are auto-discovered — no arrays to keep in sync.

set -e

# ── Public repository URL ─────────────────────────────────────────────────────
REPO_URL="https://github.com/adaptico/adaptico-os.git"
# ──────────────────────────────────────────────────────────────────────────────

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                  Adaptico OS                 ║${NC}"
echo -e "${CYAN}║     go-to-market for SaaS & AI founders      ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# INSTALL_DIR is always where the user currently is — this is where .claude/ lands.
# SCRIPT_DIR is where the source files come from (local checkout or temp clone).
INSTALL_DIR="$(pwd)"

if [ -n "$BASH_SOURCE" ] && [ "$BASH_SOURCE" != "bash" ] && [ -f "$BASH_SOURCE" ]; then
    # Local run: source files are next to this script
    SCRIPT_DIR="$(cd "$(dirname "$BASH_SOURCE")" && pwd)"
else
    # curl | bash: clone the repo to a temp dir, clean up after install
    echo -e "${YELLOW}Running remote install — cloning repository...${NC}"
    TEMP_DIR=$(mktemp -d)
    git clone --depth 1 "$REPO_URL" "$TEMP_DIR/repo" 2>/dev/null
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to clone repository from $REPO_URL${NC}"
        rm -rf "$TEMP_DIR"
        exit 1
    fi
    SCRIPT_DIR="$TEMP_DIR/repo"
fi

# Source layout (post-refactor): all installable sources live under src/.
SRC_DIR="$SCRIPT_DIR/src/core"

# Target directories — local to the working directory, not system-wide
SKILLS_DIR="$INSTALL_DIR/.claude/skills"
AGENTS_DIR="$INSTALL_DIR/.claude/agents"

echo -e "${BLUE}Source:${NC}  $SRC_DIR"
echo -e "${BLUE}Target:${NC}  $INSTALL_DIR/.claude/"
echo ""

if [ ! -d "$SRC_DIR" ]; then
    echo -e "${RED}No core sources found at $SRC_DIR${NC}"
    [ -n "$TEMP_DIR" ] && rm -rf "$TEMP_DIR"
    exit 1
fi

# Check if Claude Code is available
if command -v claude &>/dev/null; then
    echo -e "${GREEN}✓ Claude Code detected${NC}"
else
    echo -e "${YELLOW}⚠ Claude Code not found in PATH${NC}"
    if [ -t 0 ]; then
        read -p "  Continue anyway? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Installation cancelled."
            exit 0
        fi
    else
        echo "  Continuing (non-interactive mode)..."
    fi
fi

# Create directories
echo -e "\n${BLUE}Creating directories...${NC}"
mkdir -p "$SKILLS_DIR"
mkdir -p "$AGENTS_DIR"
mkdir -p "$INSTALL_DIR/projects"

# Install skills (auto-discovered — every dir with a SKILL.md, incl. the gtm orchestrator)
echo -e "\n${BLUE}Installing skills...${NC}"
SKILL_COUNT=0
INSTALLED_SKILLS=()
for skill_path in "$SRC_DIR/skills"/*/; do
    [ -d "$skill_path" ] || continue
    skill="$(basename "$skill_path")"
    if [ ! -f "$skill_path/SKILL.md" ]; then
        echo -e "  ${YELLOW}⚠${NC} $skill (no SKILL.md, skipping)"
        continue
    fi
    rm -rf "$SKILLS_DIR/$skill"
    cp -R "$skill_path" "$SKILLS_DIR/$skill"
    # Make any bundled scripts executable (e.g. gtm/scripts/*.py).
    # Pure-bash glob (no `find`) so it doesn't collide with Windows find.exe on Git Bash.
    if [ -d "$SKILLS_DIR/$skill/scripts" ]; then
        shopt -s nullglob
        for py in "$SKILLS_DIR/$skill/scripts"/*.py; do
            chmod +x "$py"
        done
        shopt -u nullglob
    fi
    echo -e "  ${GREEN}✓${NC} $skill"
    SKILL_COUNT=$((SKILL_COUNT + 1))
    INSTALLED_SKILLS+=("$skill")
done

# Install agents (auto-discovered)
echo -e "\n${BLUE}Installing agents...${NC}"
AGENT_COUNT=0
shopt -s nullglob
for agent_file in "$SRC_DIR/agents"/*.md; do
    [ "$(basename "$agent_file")" = "README.md" ] && continue
    cp "$agent_file" "$AGENTS_DIR/$(basename "$agent_file")"
    echo -e "  ${GREEN}✓${NC} $(basename "$agent_file" .md)"
    AGENT_COUNT=$((AGENT_COUNT + 1))
done
shopt -u nullglob

# Scripts and templates live inside src/core/skills/gtm/ (scripts/, templates/) and are
# installed together with the gtm skill in the loop above — no separate copy step needed.

# Python check (the analysis scripts use only the Python standard library)
echo -e "\n${BLUE}Checking Python...${NC}"
if command -v python3 &>/dev/null; then
    PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>/dev/null)
    echo -e "  ${GREEN}✓${NC} Python $PYTHON_VERSION detected (scripts run on the standard library)"
else
    echo -e "  ${YELLOW}⚠${NC} Python 3 not found — the analysis scripts won't run"
    echo -e "    Install Python: ${CYAN}https://python.org${NC}"
fi

# Cleanup temp clone if used
if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
    rm -rf "$TEMP_DIR"
fi

# Summary
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           Installation Complete!             ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Skills installed:    ${GREEN}$SKILL_COUNT${NC}  (gtm orchestrator bundles its scripts + templates)"
echo -e "  Agents installed:    ${GREEN}$AGENT_COUNT${NC}"
echo ""
echo -e "${CYAN}Available commands:${NC}"
for skill in "${INSTALLED_SKILLS[@]}"; do
    case "$skill" in
        gtm)   continue ;;                     # orchestrator/router, not a subcommand
        gtm-*) echo "  /gtm ${skill#gtm-}" ;;  # e.g. gtm-init -> /gtm init
        *)     echo "  /$skill" ;;
    esac
done
echo ""
echo -e "  ${YELLOW}Start a new Claude Code session, then run /gtm init.${NC}"
echo ""
