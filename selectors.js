// Every Todoist DOM selector the extension depends on, in one place.
// Values are unchanged from earlier versions and have to be re-checked against
// the live Todoist page whenever Todoist ships a UI update. If a selector stops
// matching, the features that use it do nothing (they never guess).
self.TMS_SELECTORS = Object.freeze({
  selectedTask: '.board_task[aria-selected="true"], [data-testid="task-card"][aria-selected="true"]',
  selectionIdTask: "[data-selection-id]",
  nativeSelectionBar: '[data-testid="multi-select-toolbar"], [class*="multi_select"], [class*="selection_toolbar"], [class*="bulk_action"]',
  taskTitle: [".board_task_details__content__inner_content", ".task_content", '[class*="inner_content"]'],
  taskDescription: [".board_task_details__description", '[class*="task_description"]', '[class*="description"]'],
  taskDue: ['[class*="due_date"]', "time"],
  taskSubtasks: '[class*="subtask"]',
  taskCheckbox: [
    'button[aria-label*="omplete" i]',
    '[data-testid="task-checkbox"]',
    'button[class*="task_checkbox"]',
    '[class*="checkbox"] button',
    '[class*="checkbox"]',
  ],
  labelsToolbarButton: '[data-action-hint="multi-select-toolbar-label-picker"]',
  sidebarMenu: "#top-menu",
  boardSection: '[data-testid="board-section"]',
  boardSectionTitle: ".board_section__title",
  sectionForm: '[data-testid="section-form"]',
  sectionNameInput: '[data-testid="section-form"] input[name="section_name"]',
  dragScrollTarget: "[data-drag-scroll-target]",
  addSectionButton: ".board_add_section_trigger__container button",
});
