// Worked Page Object for the QA Sandbox todo fixture — the shape the codifier's write_pom
// produces: a class whose members are gate-quality accessible locators (role + name) and
// whose methods wrap actions/assertions. A thin spec drives it (see todo-pom.spec.ts).
import { type Page, type Locator, expect } from '@playwright/test';

export class TodoPage {
  readonly page: Page;
  readonly newTask: Locator;
  readonly addButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.newTask = page.getByRole('textbox', { name: 'New task' });
    this.addButton = page.getByRole('button', { name: 'Add' });
  }

  async goto() {
    await this.page.goto('/');
  }

  async add(text: string) {
    await this.newTask.fill(text);
    await this.addButton.click();
  }

  async expectTask(text: string) {
    await expect(this.page.getByText(text)).toBeVisible();
  }
}
