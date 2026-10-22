import { contextBridge, ipcRenderer } from "electron"
import { electronAPI } from "@electron-toolkit/preload"
import { ProjectSettings, StoredRiffMetadata } from "../shared/types"

// Custom APIs for renderer
const api = {
  scanFolder: () => ipcRenderer.invoke("scan-folder"),
  importProjects: (paths: string[]) => ipcRenderer.invoke("import-projects", paths),
  findRppFiles: (folderPath: string) => ipcRenderer.invoke("find-rpp-files", folderPath),
  loadAudio: (filePath: string) => ipcRenderer.invoke("load-audio", filePath),
  openInReaper: (filePath: string) => ipcRenderer.invoke("open-in-reaper", filePath),
  revealInFileExplorer: (filePath: string): Promise<void> =>
    ipcRenderer.invoke("reveal-in-file-explorer", filePath),
  getDefaultModels: () => ipcRenderer.invoke("get-default-models"),
  chooseAmpFile: () => ipcRenderer.invoke("choose-amp-file"),
  chooseCabFile: () => ipcRenderer.invoke("choose-cab-file"),

  addScanPathToDB: (folderPath: string): Promise<void> =>
    ipcRenderer.invoke("library:add-scan-path", folderPath),

  removeScanPathFromDB: (path: string, projectsToRemove: string[]): Promise<void> =>
    ipcRenderer.invoke("library:remove-scan-path", path, projectsToRemove),

  getScanPathsFromDB: (): Promise<string[]> => ipcRenderer.invoke("library:get-scan-paths"),

  updateProjectSettings: (settings: ProjectSettings[]): Promise<void> =>
    ipcRenderer.invoke("library:update-project-settings", settings),

  getAllProjectSettings: (): Promise<ProjectSettings[]> =>
    ipcRenderer.invoke("library:get-all-project-settings"),

  setRiffBpm: (projectPath: string, itemGuid: string, bpm: number | null): Promise<void> =>
    ipcRenderer.invoke("library:set-riff-bpm", projectPath, itemGuid, bpm),

  getAllRiffMetadata: (): Promise<StoredRiffMetadata[]> =>
    ipcRenderer.invoke("library:get-all-riff-metadata"),

  createCustomGroup: (name: string) => ipcRenderer.invoke("library:create-custom-group", name),
  renameCustomGroup: (groupId: number, name: string) =>
    ipcRenderer.invoke("library:rename-custom-group", groupId, name),
  deleteCustomGroup: (groupId: number) =>
    ipcRenderer.invoke("library:delete-custom-group", groupId),
  getAllCustomGroups: () => ipcRenderer.invoke("library:get-all-custom-groups"),
  setRiffGroups: (projectPath: string, itemGuid: string, groupIds: number[]) =>
    ipcRenderer.invoke("library:set-riff-groups", projectPath, itemGuid, groupIds),
  getAllRiffGroupMemberships: () => ipcRenderer.invoke("library:get-all-riff-group-memberships")
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI)
    contextBridge.exposeInMainWorld("api", api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
