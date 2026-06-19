import { execFile } from "node:child_process";
import { platform } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type FolderPickerResult =
  | { selected: true; path: string }
  | { selected: false; reason: string };

export interface FolderPickerOptions {
  platform?: NodeJS.Platform;
}

export async function selectLocalFolder(options: FolderPickerOptions = {}): Promise<FolderPickerResult> {
  const currentPlatform = options.platform ?? platform();
  try {
    const path = await runFolderPicker(currentPlatform);
    return path.length > 0
      ? { selected: true, path }
      : { selected: false, reason: "Folder selection was cancelled." };
  } catch (error) {
    return {
      selected: false,
      reason: error instanceof Error ? error.message : "Folder selection is unavailable on this system."
    };
  }
}

async function runFolderPicker(currentPlatform: NodeJS.Platform): Promise<string> {
  if (currentPlatform === "darwin") {
    const { stdout } = await execFileAsync("osascript", [
      "-e",
      "POSIX path of (choose folder with prompt \"Choose a Suka workspace folder\")"
    ]);
    return stdout.trim();
  }

  if (currentPlatform === "win32") {
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-STA",
      "-Command",
      [
        "Add-Type -AssemblyName System.Windows.Forms;",
        "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog;",
        "$dialog.Description = 'Choose a Suka workspace folder';",
        "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $dialog.SelectedPath }"
      ].join(" ")
    ]);
    return stdout.trim();
  }

  if (currentPlatform === "linux") {
    const { stdout } = await execFileAsync("sh", [
      "-lc",
      [
        "if command -v zenity >/dev/null 2>&1; then",
        "zenity --file-selection --directory --title='Choose a Suka workspace folder';",
        "elif command -v kdialog >/dev/null 2>&1; then",
        "kdialog --getexistingdirectory \"$HOME\" 'Choose a Suka workspace folder';",
        "else",
        "exit 127;",
        "fi"
      ].join(" ")
    ]);
    return stdout.trim();
  }

  throw new Error(`Folder selection is not supported on ${currentPlatform}.`);
}
