// Worked example of the DEPTH pattern: a thin spec over a Page Object, importing `test`
// from ./fixtures so a captured login (storageState) is reused when present. The fixture
// app has no auth, so this exercises the unauthenticated fallback — proving the pattern
// stays green on a fresh checkout. Authored → excluded from `npm test`; runs under
// RUN_AUTHORED=1 (run_spec, or `RUN_AUTHORED=1 playwright test todo-pom`).
import { test } from './fixtures';
import { TodoPage } from './todo.pom';

test('todo POM: add a task (auth reused when captured, else unauthenticated)', async ({ page }) => {
  const todo = new TodoPage(page);
  await todo.goto();
  await todo.add('buy milk');
  await todo.expectTask('buy milk');
});
