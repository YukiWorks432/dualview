import { ChevronDown, Sparkles } from 'lucide-react'

import {
  comparisonModeDefinitions,
  comparisonModeGroups,
  getComparisonModeDefinition,
  primaryComparisonModes,
  secondaryComparisonModes,
} from '../../config/comparisonModes'
import { useProjectStore } from '../../stores/projectStore'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Kbd } from '../ui/kbd'
import { TooltipContent, TooltipRoot, TooltipTrigger } from '../ui/tooltip'

export function ComparisonModePicker() {
  const { comparisonMode, setComparisonMode } = useProjectStore()
  const currentMode = getComparisonModeDefinition(comparisonMode)
  const CurrentModeIcon = currentMode.icon
  const activeSecondaryMode = secondaryComparisonModes.find(
    (definition) => definition.mode === comparisonMode,
  )
  const ActiveSecondaryIcon = activeSecondaryMode?.icon

  return (
    <>
      <Dialog>
        <DialogTrigger
          render={
            <Button
              variant="secondary"
              size="sm"
              className="show-mobile h-8 items-center gap-2 px-3"
              aria-label="Choose comparison mode"
            />
          }
        >
          <CurrentModeIcon className="h-4 w-4 text-accent" aria-hidden="true" />
          <span>{currentMode.label}</span>
          <ChevronDown className="h-3 w-3 text-text-muted" aria-hidden="true" />
        </DialogTrigger>
        <DialogContent
          showCloseButton={false}
          viewportClassName="items-end p-0 md:hidden"
          className="max-h-[70vh] max-w-none overflow-y-auto rounded-b-none border-x-0 border-b-0"
        >
          <div className="border-b border-border p-4">
            <DialogTitle className="text-sm font-semibold">Comparison Mode</DialogTitle>
            <DialogDescription className="mt-1 text-xs text-text-muted">
              Choose how the current sources are compared.
            </DialogDescription>
          </div>
          <div className="safe-area-bottom grid grid-cols-2 gap-2 p-2">
            {comparisonModeDefinitions.map(({ mode, icon: Icon, label, description }) => (
              <DialogClose
                key={mode}
                render={
                  <button
                    type="button"
                    onClick={() => setComparisonMode(mode)}
                    className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-md border p-4 text-center outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                      comparisonMode === mode
                        ? 'border-border-hover bg-surface-active text-text-primary'
                        : 'border-border bg-surface hover:border-border-hover hover:bg-surface-hover'
                    }`}
                  />
                }
              >
                <Icon
                  className={`h-6 w-6 ${comparisonMode === mode ? 'text-accent' : 'text-text-secondary'}`}
                  aria-hidden="true"
                />
                <span className="text-sm font-medium">{label}</span>
                <span className="text-[10px] text-text-muted">{description}</span>
              </DialogClose>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <div
        className="hide-mobile flex items-center gap-0.5"
        role="tablist"
        aria-label="Comparison modes"
      >
        {primaryComparisonModes.map(({ mode, icon: Icon, label, shortcut, description }) => (
          <TooltipRoot key={mode}>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setComparisonMode(mode)}
                  className={`relative h-7 gap-1 px-2 text-xs ${
                    comparisonMode === mode
                      ? 'border-border-hover bg-surface-active text-text-primary'
                      : 'border-transparent'
                  }`}
                  aria-selected={comparisonMode === mode}
                  aria-label={`${label} comparison mode`}
                  role="tab"
                />
              }
            >
              <Icon
                className={`h-3.5 w-3.5 ${comparisonMode === mode ? 'text-accent' : ''}`}
                aria-hidden="true"
              />
              <span className="hidden lg:inline">{label}</span>
              {comparisonMode === mode && (
                <span className="absolute -bottom-px left-1/2 h-px w-3/4 -translate-x-1/2 bg-accent" />
              )}
            </TooltipTrigger>
            <TooltipContent>
              <div className="font-medium">{label}</div>
              <div className="mt-0.5 text-[10px] text-text-muted">{description}</div>
              {shortcut && (
                <div className="mt-1 flex items-center gap-1">
                  <Kbd>{shortcut.key}</Kbd>
                  <span className="text-[9px] text-text-muted">to switch</span>
                </div>
              )}
            </TooltipContent>
          </TooltipRoot>
        ))}

        <div className="mx-0.5 h-4 w-px bg-border" />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 gap-1 px-2 text-xs ${
                  activeSecondaryMode
                    ? 'border-border-hover bg-surface-active text-text-primary'
                    : 'border-transparent'
                }`}
                aria-label="More comparison modes"
              />
            }
          >
            {activeSecondaryMode && ActiveSecondaryIcon ? (
              <>
                <ActiveSecondaryIcon className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                <span className="hidden lg:inline">{activeSecondaryMode.label}</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden lg:inline">More</span>
              </>
            )}
            <ChevronDown className="h-2.5 w-2.5" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-64 py-2">
            <div className="border-b border-border px-3 pb-2 text-[10px] text-text-muted">
              Advanced comparison tools for detailed analysis
            </div>
            {comparisonModeGroups.map((group, index) => (
              <DropdownMenuGroup key={group.id}>
                {index > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="pb-0 text-[10px] uppercase tracking-wider">
                  {group.name}
                </DropdownMenuLabel>
                <div className="px-3 pb-1 text-[9px] text-text-muted">{group.description}</div>
                {group.modes.map(({ mode, icon: Icon, label, description, shortcut }) => (
                  <DropdownMenuItem
                    key={mode}
                    onClick={() => setComparisonMode(mode)}
                    className={comparisonMode === mode ? 'bg-surface-active text-text-primary' : undefined}
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-sm ${
                        comparisonMode === mode
                          ? 'bg-surface-hover text-accent'
                          : 'bg-surface-alt text-text-secondary'
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{label}</span>
                      <span className="block truncate text-[10px] text-text-muted">
                        {description}
                      </span>
                    </span>
                    {shortcut && <DropdownMenuShortcut>{shortcut.key}</DropdownMenuShortcut>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}
