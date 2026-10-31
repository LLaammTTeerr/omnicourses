#!/usr/bin/env bash
# OmniCourse Report Build & Packaging Tool (Bash)
# Supports building all, weekly, pa1, pa2, specific weeks, packaging, or clean.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-all}"
# Pinned TeX Live release; bump the dated tag deliberately, never use :latest
TEXLIVE_IMAGE="ghcr.io/xu-cheng/texlive-full:20261001"

# Support --docker flag
if [ "$TARGET" = "--docker" ] || [ "${2:-}" = "--docker" ]; then
  DOCKER_TARGET="$TARGET"
  if [ "$DOCKER_TARGET" = "--docker" ]; then
    DOCKER_TARGET="${2:-all}"
  fi
  RUNTIME=""
  if command -v podman >/dev/null 2>&1; then
    RUNTIME="podman"
  elif command -v docker >/dev/null 2>&1; then
    RUNTIME="docker"
  else
    echo "Error: Neither docker nor podman is available in PATH." >&2
    exit 1
  fi
  PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
  # Git Bash on Windows: pass a Windows host path and stop MSYS from rewriting /work
  if command -v cygpath >/dev/null 2>&1; then
    PROJECT_ROOT="$(cygpath -w "$PROJECT_ROOT")"
    export MSYS_NO_PATHCONV=1
  fi
  echo "Running XeLaTeX build via $RUNTIME container ($TEXLIVE_IMAGE)..."
  exec "$RUNTIME" run --rm -v "$PROJECT_ROOT:/work" -w /work/report "$TEXLIVE_IMAGE" bash ./build.sh "$DOCKER_TARGET"
fi

clean_aux() {
  find "$SCRIPT_DIR" -type f \( -name "*.aux" -o -name "*.log" -o -name "*.out" -o -name "*.toc" -o -name "*.build.log" \) -delete 2>/dev/null || true
}

if [ "$TARGET" = "clean" ]; then
  echo "Cleaning auxiliary LaTeX files..."
  clean_aux
  echo "Clean completed."
  exit 0
fi

# Pre-flight check for the real team metadata (git-ignored)
if [ ! -f "$SCRIPT_DIR/shared/meta.tex" ]; then
  echo "Error: report/shared/meta.tex is missing." >&2
  echo "Copy meta.example.tex to meta.tex and fill in the real names, student IDs and group ID:" >&2
  echo "  cp report/shared/meta.example.tex report/shared/meta.tex" >&2
  exit 1
fi

# Pre-flight check for xelatex
if ! command -v xelatex >/dev/null 2>&1; then
  echo "Error: 'xelatex' not found in PATH." >&2
  echo "To build without installing local TeX tools, run with Docker/Podman:" >&2
  echo "  ./build.sh --docker [target]" >&2
  exit 1
fi

compile_tex() {
  local tex_path="$1"
  local file_dir="$(dirname "$tex_path")"
  local file_name="$(basename "$tex_path" .tex)"
  local rel_path="${tex_path#$SCRIPT_DIR/}"

  printf '%-45s ' "$rel_path"

  local log_file="$file_dir/$file_name.build.log"

  # Pass 1
  xelatex -interaction=nonstopmode -halt-on-error -output-directory="$file_dir" "$tex_path" > "$log_file" 2>&1 || {
    echo "FAILED (Pass 1), see $log_file"
    return 1
  }

  # Pass 2 (TOC and cross-refs)
  xelatex -interaction=nonstopmode -halt-on-error -output-directory="$file_dir" "$tex_path" > "$log_file" 2>&1 || {
    echo "FAILED (Pass 2), see $log_file"
    return 1
  }

  if [ -f "$file_dir/$file_name.pdf" ]; then
    echo "OK"
    rm -f "$log_file"
    return 0
  else
    echo "NO PDF"
    return 1
  fi
}

get_group_id() {
  local meta="$SCRIPT_DIR/shared/meta.tex"
  if [ -f "$meta" ]; then
    grep -o '\\OmniCourseGroup}{[^}]*' "$meta" | cut -d'{' -f2 || echo "PA1-GroupXX"
  else
    echo "PA1-GroupXX"
  fi
}

create_zip() {
  local zip_name="$1"
  local dir_to_zip="$2"
  if command -v zip >/dev/null 2>&1; then
    (cd "$SCRIPT_DIR/dist" && zip -r "$zip_name" "$dir_to_zip")
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c "import shutil, sys; shutil.make_archive('$SCRIPT_DIR/dist/' + sys.argv[1].replace('.zip',''), 'zip', '$SCRIPT_DIR/dist', sys.argv[2])" "$zip_name" "$dir_to_zip"
  else
    echo "Warning: neither 'zip' nor 'python3' found to package $zip_name." >&2
  fi
}

# Packaging
if [ "$TARGET" = "package-pa1" ] || [ "$TARGET" = "pa1-package" ]; then
  GROUP_ID="$(get_group_id)"
  echo "=== Packaging PA1 Submission ($GROUP_ID) ==="
  compile_tex "$SCRIPT_DIR/assignments/PA1/ProjectPlan.tex"
  compile_tex "$SCRIPT_DIR/assignments/PA1/Vision.tex"
  compile_tex "$SCRIPT_DIR/weekly/WeeklyReport-Week01.tex"
  compile_tex "$SCRIPT_DIR/weekly/WeeklyReport-Week02.tex"

  DIST_DIR="$SCRIPT_DIR/dist/$GROUP_ID"
  rm -rf "$DIST_DIR"
  mkdir -p "$DIST_DIR"

  cp "$SCRIPT_DIR/assignments/PA1/ProjectPlan.pdf" "$DIST_DIR/"
  cp "$SCRIPT_DIR/assignments/PA1/Vision.pdf" "$DIST_DIR/"
  cp "$SCRIPT_DIR/weekly/WeeklyReport-Week01.pdf" "$DIST_DIR/"
  cp "$SCRIPT_DIR/weekly/WeeklyReport-Week02.pdf" "$DIST_DIR/"

  create_zip "$GROUP_ID.zip" "$GROUP_ID"
  clean_aux
  echo "PA1 packaged into $SCRIPT_DIR/dist/$GROUP_ID.zip"
  exit 0
fi

if [ "$TARGET" = "package-pa2" ] || [ "$TARGET" = "pa2-package" ]; then
  GROUP_ID="$(get_group_id | sed 's/PA1/PA2/')"
  echo "=== Packaging PA2 Submission ($GROUP_ID) ==="
  compile_tex "$SCRIPT_DIR/assignments/PA2/ProjectPlan.tex"
  compile_tex "$SCRIPT_DIR/assignments/PA2/Vision.tex"
  compile_tex "$SCRIPT_DIR/assignments/PA2/UseCase-Specification.tex"
  compile_tex "$SCRIPT_DIR/weekly/WeeklyReport-Week03.tex"
  compile_tex "$SCRIPT_DIR/weekly/WeeklyReport-Week04.tex"

  DIST_DIR="$SCRIPT_DIR/dist/$GROUP_ID"
  rm -rf "$DIST_DIR"
  mkdir -p "$DIST_DIR"

  cp "$SCRIPT_DIR/assignments/PA2/ProjectPlan.pdf" "$DIST_DIR/"
  cp "$SCRIPT_DIR/assignments/PA2/Vision.pdf" "$DIST_DIR/"
  cp "$SCRIPT_DIR/assignments/PA2/UseCase-Specification.pdf" "$DIST_DIR/"
  cp "$SCRIPT_DIR/weekly/WeeklyReport-Week03.pdf" "$DIST_DIR/"
  cp "$SCRIPT_DIR/weekly/WeeklyReport-Week04.pdf" "$DIST_DIR/"

  create_zip "$GROUP_ID.zip" "$GROUP_ID"
  clean_aux
  echo "PA2 packaged into $SCRIPT_DIR/dist/$GROUP_ID.zip"
  exit 0
fi

# Target files selection
FILES=()
case "$TARGET" in
  all)
    while IFS= read -r f; do FILES+=("$f"); done < <(find "$SCRIPT_DIR/assignments" "$SCRIPT_DIR/weekly" -name "*.tex")
    ;;
  weekly)
    while IFS= read -r f; do FILES+=("$f"); done < <(find "$SCRIPT_DIR/weekly" -name "*.tex")
    ;;
  pa1)
    while IFS= read -r f; do FILES+=("$f"); done < <(find "$SCRIPT_DIR/assignments/PA1" -name "*.tex")
    ;;
  pa2)
    while IFS= read -r f; do FILES+=("$f"); done < <(find "$SCRIPT_DIR/assignments/PA2" -name "*.tex")
    ;;
  week[0-9]|week[0-9][0-9]|week-[0-9]|week-[0-9][0-9])
    NUM=$(echo "$TARGET" | grep -o '[0-9]\+')
    PADDED=$(printf "%02d" "$NUM")
    FILES=("$SCRIPT_DIR/weekly/WeeklyReport-Week$PADDED.tex")
    ;;
  *)
    if [ -f "$TARGET" ]; then
      FILES=("$TARGET")
    else
      echo "Unknown target: $TARGET"
      echo "Options: all, weekly, pa1, pa2, week1..week10, pa1-package, pa2-package, clean"
      exit 1
    fi
    ;;
esac

echo "=== OmniCourse Report Builder: ${#FILES[@]} file(s) ==="
for f in "${FILES[@]}"; do
  compile_tex "$f"
done

clean_aux
echo "All done."
