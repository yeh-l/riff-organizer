import Database from "better-sqlite3"
import { app } from "electron"
import path from "path"
import {
  CustomGroup,
  ProjectSettings,
  StoredRiffGroupMembership,
  StoredRiffMetadata
} from "../shared/types"

let db: Database.Database
const favoritesGroupName = "Favorites"

export function initDatabase(): void {
  const dbPath = path.join(app.getPath("userData"), "library.db")

  db = new Database(dbPath)

  db.exec(`
    CREATE TABLE IF NOT EXISTS scan_paths (
      id INTEGER PRIMARY KEY,
      path TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS project_settings (
      project_path TEXT PRIMARY KEY,
      hidden INTEGER NOT NULL DEFAULT 0,
      recorded_to_click INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS riff_metadata (
      project_path TEXT NOT NULL,
      item_guid TEXT NOT NULL,
      name TEXT,
      notes TEXT,
      manual_bpm REAL,
      PRIMARY KEY (project_path, item_guid)
    );

    CREATE TABLE IF NOT EXISTS custom_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      is_system INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS riff_group_memberships (
      group_id INTEGER NOT NULL,
      project_path TEXT NOT NULL,
      item_guid TEXT NOT NULL,
      PRIMARY KEY (group_id, project_path, item_guid),
      FOREIGN KEY (group_id) REFERENCES custom_groups(id) ON DELETE CASCADE
    );
  `)

  db.pragma("foreign_keys = ON")
  db.prepare("INSERT OR IGNORE INTO custom_groups (name, is_system) VALUES (?, 1)").run(
    favoritesGroupName
  )
}

export function addScanPathToDB(path: string): void {
  db.prepare(
    `
    INSERT OR IGNORE INTO scan_paths (path)
    VALUES (?)
  `
  ).run(path)
}

export function removeScanPathFromDB(scanPath: string, removedProjectPaths: string[]): void {
  const removeScanPath = db.prepare(`
    DELETE FROM scan_paths
    WHERE path = ?
  `)

  const removeProjectSettings = db.prepare(`
    DELETE FROM project_settings
    WHERE project_path = ?
  `)

  const transaction = db.transaction(() => {
    removeScanPath.run(scanPath)

    for (const projectPath of removedProjectPaths) {
      removeProjectSettings.run(projectPath)
    }
  })

  transaction()
}

export function getScanPathsFromDB(): string[] {
  const rows = db
    .prepare(
      `
    SELECT path FROM scan_paths
  `
    )
    .all() as { path: string }[]

  return rows.map((row) => row.path)
}

export function updateProjectSettings(settings: ProjectSettings[]): void {
  const statement = db.prepare(`
    INSERT INTO project_settings (
      project_path,
      hidden,
      recorded_to_click
    )
    VALUES (?, ?, ?)
    ON CONFLICT(project_path)
    DO UPDATE SET
      hidden = excluded.hidden,
      recorded_to_click = excluded.recorded_to_click
  `)

  const transaction = db.transaction(() => {
    for (const setting of settings) {
      statement.run(setting.projectPath, setting.hidden ? 1 : 0, setting.recordedToClick ? 1 : 0)
    }
  })

  transaction()
}

export function setRiffBpm(projectPath: string, itemGuid: string, bpm: number | null): void {
  db.prepare(
    `
    INSERT INTO riff_metadata (project_path, item_guid, manual_bpm)
    VALUES (?, ?, ?)
    ON CONFLICT(project_path, item_guid)
    DO UPDATE SET manual_bpm = excluded.manual_bpm
  `
  ).run(projectPath, itemGuid, bpm)
}

export function createCustomGroup(name: string): CustomGroup {
  const result = db.prepare("INSERT INTO custom_groups (name, is_system) VALUES (?, 0)").run(name)
  return { id: Number(result.lastInsertRowid), name, isSystem: false }
}

export function renameCustomGroup(groupId: number, name: string): void {
  db.prepare("UPDATE custom_groups SET name = ? WHERE id = ? AND is_system = 0").run(name, groupId)
}

export function deleteCustomGroup(groupId: number): void {
  db.prepare("DELETE FROM custom_groups WHERE id = ? AND is_system = 0").run(groupId)
}

export function getAllCustomGroups(): CustomGroup[] {
  return db
    .prepare(
      "SELECT id, name, is_system FROM custom_groups ORDER BY is_system DESC, name COLLATE NOCASE"
    )
    .all()
    .map((row) => {
      const group = row as { id: number; name: string; is_system: number }

      return {
        id: group.id,
        name: group.name,
        isSystem: group.is_system === 1
      }
    })
}

export function setRiffGroups(projectPath: string, itemGuid: string, groupIds: number[]): void {
  const removeMemberships = db.prepare(
    "DELETE FROM riff_group_memberships WHERE project_path = ? AND item_guid = ?"
  )
  const addMembership = db.prepare(
    "INSERT INTO riff_group_memberships (group_id, project_path, item_guid) VALUES (?, ?, ?)"
  )

  db.transaction(() => {
    removeMemberships.run(projectPath, itemGuid)

    for (const groupId of groupIds) {
      addMembership.run(groupId, projectPath, itemGuid)
    }
  })()
}

export function getAllRiffGroupMemberships(): StoredRiffGroupMembership[] {
  return db
    .prepare("SELECT group_id, project_path, item_guid FROM riff_group_memberships")
    .all()
    .map((row) => {
      const membership = row as {
        group_id: number
        project_path: string
        item_guid: string
      }

      return {
        groupId: membership.group_id,
        projectPath: membership.project_path,
        itemGuid: membership.item_guid
      }
    })
}

export function getAllProjectSettings(): ProjectSettings[] {
  const rows = db
    .prepare(
      `
    SELECT project_path, hidden, recorded_to_click
    FROM project_settings
  `
    )
    .all() as {
    project_path: string
    hidden: number
    recorded_to_click: number
  }[]

  return rows.map((row) => ({
    projectPath: row.project_path,
    hidden: row.hidden === 1,
    recordedToClick: row.recorded_to_click === 1
  }))
}

export function getAllRiffMetadata(): StoredRiffMetadata[] {
  const rows = db
    .prepare(
      `
    SELECT project_path, item_guid, manual_bpm
    FROM riff_metadata
  `
    )
    .all() as {
    project_path: string
    item_guid: string
    manual_bpm: number | null
  }[]

  return rows.map((row) => ({
    projectPath: row.project_path,
    itemGuid: row.item_guid,
    manualBpm: row.manual_bpm
  }))
}
