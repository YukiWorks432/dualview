/**
 * ProjectSelector Component (PERSIST-003, PROJECT-001)
 *
 * Modal for browsing, creating, loading, and managing projects.
 */

import {
  Calendar,
  Copy,
  Download,
  FileImage,
  FolderOpen,
  Loader2,
  Plus,
  Search,
  Tag,
  Trash2,
  Upload,
} from 'lucide-react'
import { useState } from 'react'

import { usePersistenceStore, type ProjectMetadata } from '../../stores/persistenceStore'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'

interface ProjectSelectorProps {
  isOpen: boolean
  onClose: () => void
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function ProjectSelector({ isOpen, onClose }: ProjectSelectorProps) {
  const {
    projects,
    currentProjectId,
    isLoading,
    storageUsage,
    createNewProject,
    loadProject,
    deleteProject,
    duplicateProject,
    exportProject,
    importProject,
  } = usePersistenceStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const filteredProjects = projects.filter(
    (project) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase())),
  )

  const handleNewProject = async () => {
    await createNewProject()
    onClose()
  }

  const handleLoadProject = async (projectId: string) => {
    await loadProject(projectId)
    onClose()
  }

  const handleDeleteProject = async (projectId: string) => {
    await deleteProject(projectId)
    setDeleteConfirmId(null)
    if (selectedProjectId === projectId) {
      setSelectedProjectId(null)
    }
  }

  const handleExportProject = async (projectId: string) => {
    setIsExporting(true)
    try {
      const blob = await exportProject(projectId)
      const project = projects.find((item) => item.id === projectId)
      const filename = `${project?.name || 'project'}.dualview`

      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportProject = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.dualview'
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (!file) return

      setIsImporting(true)
      try {
        await importProject(file)
      } catch (error) {
        console.error('Import failed:', error)
      } finally {
        setIsImporting(false)
      }
    }
    input.click()
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        className="flex max-h-[85vh] max-w-4xl flex-col overflow-hidden p-0"
        backdropClassName="bg-black/70 backdrop-blur-sm"
      >
        <div className="border-b border-border px-6 py-4 pr-14">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-5 w-5 text-accent" aria-hidden="true" />
            <div>
              <DialogTitle className="text-lg font-semibold">Projects</DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-text-muted">
                Open, duplicate, import, export, or remove saved DualView projects.
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-3">
          <Button size="sm" onClick={handleNewProject}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Project
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleImportProject}
            disabled={isImporting}
          >
            {isImporting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="h-4 w-4" aria-hidden="true" />
            )}
            Import
          </Button>

          <div className="min-w-56 flex-1" />

          <div className="relative w-full sm:w-64">
            <label htmlFor="project-search" className="sr-only">
              Search projects
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <Input
              id="project-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search projects..."
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {isLoading && (
            <div className="flex items-center justify-center py-12" aria-live="polite">
              <Loader2 className="h-8 w-8 animate-spin text-accent" aria-hidden="true" />
              <span className="sr-only">Loading projects</span>
            </div>
          )}

          {!isLoading && filteredProjects.length === 0 && (
            <div className="empty-state py-12">
              <FolderOpen className="empty-state-icon" aria-hidden="true" />
              <p className="text-sm">
                {searchQuery ? 'No projects match your search' : 'No projects yet'}
              </p>
              {!searchQuery && (
                <Button variant="ghost" size="sm" onClick={handleNewProject} className="mt-4">
                  Create your first project
                </Button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                isActive={project.id === currentProjectId}
                isSelected={project.id === selectedProjectId}
                showDeleteConfirm={deleteConfirmId === project.id}
                isExporting={isExporting}
                onSelect={() => setSelectedProjectId(project.id)}
                onLoad={() => handleLoadProject(project.id)}
                onDelete={() => setDeleteConfirmId(project.id)}
                onConfirmDelete={() => handleDeleteProject(project.id)}
                onCancelDelete={() => setDeleteConfirmId(null)}
                onDuplicate={() => duplicateProject(project.id)}
                onExport={() => handleExportProject(project.id)}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-3 text-xs text-text-muted">
          <div>
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-3">
            <span>
              Storage: {formatBytes(storageUsage.used)} / {formatBytes(storageUsage.quota)}
            </span>
            <div
              className="h-1.5 w-24 overflow-hidden bg-border"
              role="progressbar"
              aria-label="Project storage used"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(storageUsage.percentUsed, 100)}
            >
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${Math.min(storageUsage.percentUsed, 100)}%` }}
              />
            </div>
            <span>{storageUsage.percentUsed.toFixed(1)}%</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface ProjectCardProps {
  project: ProjectMetadata
  isActive: boolean
  isSelected: boolean
  showDeleteConfirm: boolean
  isExporting: boolean
  onSelect: () => void
  onLoad: () => void
  onDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
  onDuplicate: () => unknown
  onExport: () => void
}

function ProjectCard({
  project,
  isActive,
  isSelected,
  showDeleteConfirm,
  isExporting,
  onSelect,
  onLoad,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
  onDuplicate,
  onExport,
}: ProjectCardProps) {
  return (
    <article
      className={`relative overflow-hidden border bg-surface-alt transition-colors ${
        isActive ? 'border-accent bg-accent/10' : 'border-border'
      } ${isSelected ? 'selected-ring' : ''} hover:border-border-hover`}
    >
      <button
        type="button"
        onClick={onSelect}
        onDoubleClick={onLoad}
        aria-pressed={isSelected}
        aria-label={`Select project ${project.name}`}
        className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
      >
        <div className="aspect-video bg-surface flex items-center justify-center">
          {project.thumbnail ? (
            <img src={project.thumbnail} alt="" className="h-full w-full object-cover" />
          ) : (
            <FileImage className="h-12 w-12 text-text-muted" aria-hidden="true" />
          )}
        </div>

        <div className="p-3">
          <h3 className="truncate font-medium text-text-primary">{project.name}</h3>
          {project.description && (
            <p className="mt-1 line-clamp-2 text-xs text-text-secondary">{project.description}</p>
          )}
          <div className="mt-2 flex items-center gap-2 text-xs text-text-muted">
            <Calendar className="h-3 w-3" aria-hidden="true" />
            <span>{formatDate(project.updatedAt)}</span>
          </div>
          {project.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <Tag className="h-3 w-3 text-text-muted" aria-hidden="true" />
              {project.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="border border-border bg-surface px-1.5 py-0.5 text-xs text-text-secondary"
                >
                  {tag}
                </span>
              ))}
              {project.tags.length > 3 && (
                <span className="text-xs text-text-muted">+{project.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </button>

      {isSelected && !showDeleteConfirm && (
        <div className="flex items-center gap-1 border-t border-border bg-surface/95 p-2">
          <Button size="sm" onClick={onLoad} className="h-7 flex-1">
            Open
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={() => {
              void onDuplicate()
            }}
            className="h-7 w-7"
            aria-label={`Duplicate ${project.name}`}
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={onExport}
            disabled={isExporting}
            className="h-7 w-7"
            aria-label={`Export ${project.name}`}
          >
            {isExporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </Button>
          <Button
            variant="destructive"
            size="icon"
            onClick={onDelete}
            className="h-7 w-7"
            aria-label={`Delete ${project.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/95 p-4">
          <p className="mb-3 text-center text-sm text-text-primary">
            Delete <strong>{project.name}</strong>?
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onCancelDelete}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={onConfirmDelete}>
              Delete
            </Button>
          </div>
        </div>
      )}

      {isActive && (
        <div className="absolute right-2 top-2 bg-accent px-2 py-0.5 text-xs text-white">
          Current
        </div>
      )}
    </article>
  )
}
