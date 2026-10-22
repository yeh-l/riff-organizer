import { ElectronAPI } from "@electron-toolkit/preload"
import type {
  CustomGroup,
  Project,
  ProjectSettings,
  ScanResult,
  StoredRiffMetadata,
  StoredRiffGroupMembership
} from "../shared/types"
declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      scanFolder: () => Promise<ScanResult | undefined>
      importProjects: (paths: string[]) => Promise<Project[]>
      findRppFiles: (folderPath: string) => Promise<string[]>
      loadAudio: (filePath: string) => Promise<Uint8Array | null>
      openInReaper: (filePath: string) => Promise<void>
      revealInFileExplorer: (filePath: string) => Promise<void>
      getDefaultModels: () => Promise<{
        clean: string | null
        crunch: string | null
        highGain: string | null
        cab: string | null
      }>
      chooseAmpFile: () => Promise<string | null>
      chooseCabFile: () => Promise<string | null>

      addScanPathToDB: (folderPath: string) => Promise<void>
      removeScanPathFromDB: (path: string, projectsToRemove: string[]) => Promise<void>
      getScanPathsFromDB: () => Promise<string[]>
      updateProjectSettings: (settings: ProjectSettings[]) => Promise<void>
      setRiffBpm: (projectPath: string, itemGuid: string, bpm: number | null) => Promise<void>
      getAllProjectSettings: () => Promise<ProjectSettings[]>
      getAllRiffMetadata: () => Promise<StoredRiffMetadata[]>
      createCustomGroup: (name: string) => Promise<CustomGroup>
      renameCustomGroup: (groupId: number, name: string) => Promise<void>
      deleteCustomGroup: (groupId: number) => Promise<void>
      getAllCustomGroups: () => Promise<CustomGroup[]>
      setRiffGroups: (projectPath: string, itemGuid: string, groupIds: number[]) => Promise<void>
      getAllRiffGroupMemberships: () => Promise<StoredRiffGroupMembership[]>
    }
  }
}
