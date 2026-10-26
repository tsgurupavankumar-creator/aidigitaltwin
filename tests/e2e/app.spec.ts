import { test, expect, type Page } from '@playwright/test';

/**
 * Browser checks of the main flows. Read-only by default.
 *
 * Accounts (an enrolled student and a faculty member who teaches at least one course):
 *   E2E_STUDENT_ROLL, E2E_STUDENT_DOB (YYYY-MM-DD), E2E_STUDENT_PASSWORD
 *   E2E_FACULTY_ID, E2E_FACULTY_PASSWORD
 * Tests that WRITE data (save attendance, enroll a student) run only with E2E_ALLOW_WRITES=yes;
 * never set it against the team's shared database. E2E_ENROLL_ROLL = a roll number to enroll.
 */
const env = process.env;
const student = { roll: env.E2E_STUDENT_ROLL, dob: env.E2E_STUDENT_DOB, password: env.E2E_STUDENT_PASSWORD };
const faculty = { id: env.E2E_FACULTY_ID, password: env.E2E_FACULTY_PASSWORD };
const writes = env.E2E_ALLOW_WRITES === 'yes';

async function loginStudent(page: Page) {
  await page.goto('/login/student');
  await page.locator('#student-roll-number').fill(student.roll!);
  await page.locator('#student-dob').fill(student.dob!);
  await page.locator('input[type="password"]').fill(student.password!);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/student(?:\?.*)?$/);
}

async function loginFaculty(page: Page) {
  await page.goto('/login/faculty');
  await page.locator('#faculty-id').fill(faculty.id!);
  await page.locator('#faculty-password').fill(faculty.password!);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/faculty(?:\?.*)?$/);
}

async function openFirstCourse(page: Page) {
  await page.goto('/faculty/courses');
  const course = page.locator('a[href^="/faculty/courses/"]').first();
  await expect(course, 'the faculty account must teach at least one course').toBeVisible();
  await course.click();
  await expect(page).toHaveURL(/\/faculty\/courses\/[^/]+$/);
}

test.describe('student', () => {
  test.skip(!student.roll || !student.dob || !student.password, 'Set E2E_STUDENT_ROLL, E2E_STUDENT_DOB and E2E_STUDENT_PASSWORD.');

  test('signs in and sees the weekly review action', async ({ page }) => {
    await loginStudent(page);
    await expect(page.getByRole('button', { name: 'RUN WEEKLY REVIEW' })).toBeVisible();
  });

  test('running the weekly review completes without an error page (works with the LLM on, off or failing)', async ({ page }) => {
    await loginStudent(page);
    const run = page.waitForResponse((r) => r.url().includes('/api/agents/run') && r.request().method() === 'POST', { timeout: 60_000 });
    await page.getByRole('button', { name: 'RUN WEEKLY REVIEW' }).click();
    const response = await run;
    expect(response.status(), 'the review request must not fail').toBeLessThan(500);
    await expect(page.getByText(/application error|internal server error/i)).toHaveCount(0);
  });

  test('opens the quizzes page', async ({ page }) => {
    await loginStudent(page);
    await page.goto('/student/quizzes');
    await expect(page.getByText(/application error|internal server error/i)).toHaveCount(0);
  });
});

test.describe('faculty', () => {
  test.skip(!faculty.id || !faculty.password, 'Set E2E_FACULTY_ID and E2E_FACULTY_PASSWORD.');

  test('opens a course and its four data-entry pages (attendance, grades, quizzes, import)', async ({ page }) => {
    await loginFaculty(page);
    await openFirstCourse(page);
    const courseUrl = page.url();
    for (const [path, heading] of [['attendance', 'Attendance'], ['grades', 'Assignments & grades'], ['quizzes', 'Quizzes'], ['import', 'Import CSV']]) {
      await page.goto(courseUrl);
      await page.locator(`a[href$="/${path}"]`).first().click();
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    }
  });

  test('sees the at-risk list', async ({ page }) => {
    await loginFaculty(page);
    await page.goto('/faculty/at-risk');
    await expect(page.getByText(/application error|internal server error/i)).toHaveCount(0);
  });

  test('saves attendance for a new lecture (WRITES data)', async ({ page }) => {
    test.skip(!writes, 'Writes data: set E2E_ALLOW_WRITES=yes on a test database only.');
    await loginFaculty(page);
    await openFirstCourse(page);
    await page.locator('a[href$="/attendance"]').first().click();
    await page.getByRole('button', { name: 'Add lecture' }).click();
    await page.getByRole('button', { name: 'All present' }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(/Saved \d+ attendance mark/)).toBeVisible();
  });

  test('enrolls a student by roll number (WRITES data)', async ({ page }) => {
    test.skip(!writes || !env.E2E_ENROLL_ROLL, 'Writes data: set E2E_ALLOW_WRITES=yes and E2E_ENROLL_ROLL on a test database only.');
    await loginFaculty(page);
    await openFirstCourse(page);
    await page.getByPlaceholder(/24BCE/).fill(env.E2E_ENROLL_ROLL!);
    await page.getByRole('button', { name: 'Enroll', exact: true }).click();
    await expect(page.getByText(/Enrolled \d+/)).toBeVisible();
  });
});
