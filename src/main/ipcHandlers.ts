import { app, dialog, ipcMain, shell } from "electron"
import { readFile } from "fs/promises"
import { importProjects, handleScanFolder, findRppFiles } from "./openRpp"
import {
  addScanPathToDB,
  createCustomGroup,
  deleteCustomGroup,
  getAllCustomGroups,
  getAllProjectSettings,
  getAllRiffGroupMemberships,
  getAllRiffMetadata,
  getScanPathsFromDB,
  removeScanPathFromDB,
  renameCustomGroup,
  setRiffBpm,
  setRiffGroups,
  updateProjectSettings
} from "./database"
import type { ProjectSettings } from "../shared/types"
import path from "path"
import fs from "fs"

export function registerIpcHandlers(): void {
  ipcMain.handle("scan-folder", handleScanFolder)
  ipcMain.handle("import-projects", (_, paths: string[]) => {
    return importProjects(paths)
  })
  ipcMain.handle("load-audio", async (_, filePath: string) => {
    try {
      return await readFile(filePath)
    } catch (error) {
      console.error("Error reading audio file:", error)
      return null
    }
  })
  ipcMain.handle("find-rpp-files", (_, folderPath: string) => {
    return findRppFiles(folderPath)
  })
  ipcMain.handle("open-in-reaper", (_, filePath: string) => {
    return shell.openPath(filePath)
  })
  ipcMain.handle("reveal-in-file-explorer", (_, filePath: string) => {
    shell.showItemInFolder(filePath)
  })

  ipcMain.handle("get-default-models", () => {
    const modelsDir = path.join(app.getPath("appData"), "riff-organizer", "models")

    function getModelPath(filename: string): string | null {
      const filePath = path.join(modelsDir, filename)
      return fs.existsSync(filePath) ? filePath : null
    }

    return {
      clean: getModelPath("Clean - Bugera G5 Infinium Clean USA DI by durchschnittsmusiker.nam"),
      crunch: getModelPath("Crunch - 1968 KT66 Marshall Plexi style amp v2.0 by ezlemoen.nam"),
      highGain: getModelPath("High Gain - EVH 5150 III Boosted by braindeadtx.nam"),
      cab: getModelPath("Cab IR - Marshall 1960ax SM57.wav")
    }
  })

  ipcMain.handle("choose-amp-file", async () => {
    const modelsDir = path.join(app.getPath("appData"), "riff-organizer", "models")
    const lastDirectoryFile = path.join(app.getPath("userData"), "amp-picker-directory.txt")

    fs.mkdirSync(modelsDir, { recursive: true })

    let defaultPath = modelsDir

    try {
      const lastDirectory = fs.readFileSync(lastDirectoryFile, "utf8").trim()

      if (lastDirectory && fs.existsSync(lastDirectory)) {
        defaultPath = lastDirectory
      }
    } catch {
      // No previous directory saved.
    }

    const result = await dialog.showOpenDialog({
      title: "Choose amp model",
      defaultPath,
      properties: ["openFile"],
      filters: [{ name: "NAM models", extensions: ["nam"] }]
    })

    if (result.canceled || !result.filePaths[0]) {
      return null
    }

    fs.writeFileSync(lastDirectoryFile, path.dirname(result.filePaths[0]), "utf8")

    return result.filePaths[0]
  })

  ipcMain.handle("choose-cab-file", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [
        {
          name: "Cabinet Impulse Response",
          extensions: ["wav"]
        }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  })

  ipcMain.handle("library:add-scan-path", (_, folderPath: string) => {
    addScanPathToDB(folderPath)
  })

  ipcMain.handle("library:remove-scan-path", (_, path: string, projectsToRemove: string[]) => {
    removeScanPathFromDB(path, projectsToRemove)
  })

  ipcMain.handle("library:get-scan-paths", () => {
    return getScanPathsFromDB()
  })

  ipcMain.handle("library:update-project-settings", (_, settings: ProjectSettings[]) => {
    updateProjectSettings(settings)
  })

  ipcMain.handle(
    "library:set-riff-bpm",
    (_, projectPath: string, itemGuid: string, bpm: number | null) => {
      setRiffBpm(projectPath, itemGuid, bpm)
    }
  )

  ipcMain.handle("library:create-custom-group", (_, name: string) => createCustomGroup(name))
  ipcMain.handle("library:rename-custom-group", (_, groupId: number, name: string) =>
    renameCustomGroup(groupId, name)
  )
  ipcMain.handle("library:delete-custom-group", (_, groupId: number) => deleteCustomGroup(groupId))

  ipcMain.handle("library:get-all-custom-groups", () => getAllCustomGroups())
  ipcMain.handle(
    "library:set-riff-groups",
    (_, projectPath: string, itemGuid: string, groupIds: number[]) =>
      setRiffGroups(projectPath, itemGuid, groupIds)
  )
  ipcMain.handle("library:get-all-riff-group-memberships", () => getAllRiffGroupMemberships())

  ipcMain.handle("library:get-all-project-settings", () => {
    return getAllProjectSettings()
  })

  ipcMain.handle("library:get-all-riff-metadata", () => {
    return getAllRiffMetadata()
  })
}
