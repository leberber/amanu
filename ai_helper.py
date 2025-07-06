import os
import sys

def combine_files_with_headers_recursive(folder_path, output_file, extensions=None, extra_files=None, exclude_dirs=None, exclude_files=None):
    """
    Combines files with specified extensions or extra filenames into one output.
    Skips specified folders, files, and unreadable/binary files.
    
    :param folder_path: Root directory to start.
    :param output_file: Output file path.
    :param extensions: List of allowed file extensions (e.g., ['.py', '.txt']).
    :param extra_files: List of extra filenames without extensions (e.g., ['Dockerfile', '.env']).
    :param exclude_dirs: Set of directory names to exclude (e.g., {'.venv', 'node_modules'}).
    :param exclude_files: Set of filenames to exclude (e.g., {'package-lock.json'}).
    """
    if exclude_dirs is None:
        exclude_dirs = {'__pycache__', '.venv', 'node_modules', '.git'}
    
    if exclude_files is None:
        exclude_files = set()

    with open(output_file, 'w', encoding='utf-8') as outfile:
        for root, dirs, files in os.walk(folder_path):
            dirs[:] = [d for d in dirs if d not in exclude_dirs]

            for filename in sorted(files):
                # Skip excluded files
                if filename in exclude_files:
                    continue
                    
                file_path = os.path.join(root, filename)
                relative_path = os.path.relpath(file_path, folder_path)

                _, ext = os.path.splitext(filename)

                if ext in ('.pyc', '.pyo', '.so', '.dll'):
                    continue

                if (extensions and ext not in extensions) and (extra_files and filename not in extra_files):
                    continue

                outfile.write(f"\n\n=== {relative_path} ===\n\n")
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as infile:
                        outfile.write(infile.read())
                except Exception as e:
                    print(f"Skipping {relative_path}: {e}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python script.py <input_directory>")
        sys.exit(1)

    input_folder = os.path.abspath(sys.argv[1])

    if not os.path.isdir(input_folder):
        print(f"Error: '{input_folder}' is not a valid directory.")
        sys.exit(1)

    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_file_path = os.path.join(script_dir, f"{sys.argv[1]}.txt")

    combine_files_with_headers_recursive(
        folder_path=input_folder,
        output_file=output_file_path,
        extensions=[".py", ".txt", ".yml", ".yaml", ".md", ".json", ".ts", ".scss"],
        extra_files=["Dockerfile", ".gitignore", ".env"],  # Removed package-lock.json from here
        exclude_dirs={'.venv', 'node_modules', '__pycache__', '.git', '.angular', 'sql', 'sql new'},  # Removed package-lock.json from here
        exclude_files={'package-lock.json'}  # Added new parameter to exclude this file
    )