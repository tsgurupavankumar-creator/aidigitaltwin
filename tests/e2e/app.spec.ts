
import { test, expect, type Page } from '@playwright/test';

const env = process.env;

const student = {
  roll: env.E2E_STUDENT_ROLL,
  dob: env.E2E_STUDENT_DOB,
  password: env.E2E_STUDENT_PASSWORD,
};

const faculty = {
  id: env.E2E_FACULTY_ID,
  password: env.E2E_FACULTY_PASSWORD,
};

const writes = env.E2E_ALLOW_WRITES === 'yes';

async function loginStudent(page: Page) {
  await page.goto('/login/student');

  await page.locator('#student-roll-number').fill(student.roll!);
  await page.locator('#student-dob').fill(student.dob!);
  await page.locator('input[type="password"]').fill(student.password!);

  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page).toHaveURL(
    /\/student(?:\?.*)?$/,
    { timeout: 15000 }
  );
}

async function loginFaculty(page: Page) {
  await page.goto('/login/faculty');

  await page.locator('#faculty-id').fill(faculty.id!);

  await page.getByRole('textbox', {
    name: 'Your faculty account password',
  }).fill(faculty.password!);

  const loginResponse = page.waitForResponse(
    response =>
      response.url().includes('/api/auth/login/faculty') &&
      response.request().method() === 'POST'
  );

  await page.getByRole('button', { name: 'Sign In' }).click();

  const response = await loginResponse;
  expect(response.status()).toBe(200);

  await expect(page).toHaveURL(
    /\/faculty(?:\\?.*)?$/,
    { timeout: 20000 }
  );

  await expect(
  page.getByRole('navigation').getByRole('link', {
    name: 'Courses',
    exact: true,
  })
).toBeVisible({ timeout: 20000 });

  const cookies = await page.context().cookies();
  expect(
    cookies.some(cookie => cookie.name === 'ai_twin_session')
  ).toBe(true);
}

async function gotoFacultyPage(page: Page, path: string) {
  await page.goto(path, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });

  const expectedPath = new URL(path, page.url()).pathname;

  await expect.poll(
    () => new URL(page.url()).pathname,
    { timeout: 15000 }
  ).toBe(expectedPath);
}

async function openFirstCourse(page: Page) {
  await gotoFacultyPage(page, '/faculty/courses');

  await expect(page).toHaveURL(
    /\/faculty\/courses(?:\?.*)?$/,
    { timeout: 15000 }
  );

  const course = page.locator(
    'a[href^="/faculty/courses/"]'
  ).first();

  await expect(
    course,
    'The faculty account must teach at least one course'
  ).toBeVisible({ timeout: 15000 });

  await course.click();

  await expect(page).toHaveURL(
    /\/faculty\/courses\/[^/]+$/,
    { timeout: 15000 }
  );
}

test.describe('student', () => {
  test.skip(
    !student.roll || !student.dob || !student.password,
    'Set E2E_STUDENT_ROLL, E2E_STUDENT_DOB and E2E_STUDENT_PASSWORD.'
  );

  test('signs in and sees the weekly review action', async ({ page }) => {
    await loginStudent(page);

    await expect(
      page.getByRole('button', { name: 'RUN WEEKLY REVIEW' })
    ).toBeVisible({ timeout: 15000 });
  });

  test('running the weekly review completes without an error page (works with the LLM on, off or failing)', async ({ page }) => {
    await loginStudent(page);

    const run = page.waitForResponse(
      response =>
        response.url().includes('/api/agents/run') &&
        response.request().method() === 'POST',
      { timeout: 60000 }
    );

    await page.getByRole('button', {
      name: 'RUN WEEKLY REVIEW',
    }).click();

    const response = await run;

    expect(
      response.status(),
      'The review request must not fail'
    ).toBeLessThan(500);

    await expect(
      page.getByText(/application error|internal server error/i)
    ).toHaveCount(0);
  });

  test('opens the quizzes page', async ({ page }) => {
    await loginStudent(page);

    await page.goto('/student/quizzes');

    await expect(
      page.getByText(/application error|internal server error/i)
    ).toHaveCount(0);
  });
});

test.describe('faculty', () => {
  test.skip(
    !faculty.id || !faculty.password,
    'Set E2E_FACULTY_ID and E2E_FACULTY_PASSWORD.'
  );

  test('opens a course and its four data-entry pages (attendance, grades, quizzes, import)', async ({ page }) => {
    await loginFaculty(page);
    await openFirstCourse(page);

    const courseUrl = page.url();

    const sections = [
      ['attendance', 'Attendance'],
      ['grades', 'Assignments & grades'],
      ['quizzes', 'Quizzes'],
      ['import', 'Import CSV'],
    ];

    for (const [path, heading] of sections) {
      await gotoFacultyPage(page, courseUrl);

      const link = page.locator(
        `a[href$="/${path}"]`
      ).first();

      await expect(link).toBeVisible({ timeout: 15000 });

      await link.click();

      await expect(
        page.getByRole('heading', {
          name: heading,
          exact: true,
        })
      ).toBeVisible({ timeout: 15000 });
    }
  });

  test('sees the at-risk list', async ({ page }) => {
    await loginFaculty(page);

    await gotoFacultyPage(page, '/faculty/at-risk');

    await expect(page).toHaveURL(
      /\/faculty\/at-risk(?:\?.*)?$/,
      { timeout: 15000 }
    );

    await expect(
      page.getByText(/application error|internal server error/i)
    ).toHaveCount(0);
  });

  test('saves attendance for a new lecture (WRITES data)', async ({ page }) => {
    test.skip(
      !writes,
      'Writes data: set E2E_ALLOW_WRITES=yes on a test database only.'
    );

    await loginFaculty(page);
    await openFirstCourse(page);

    await page.locator(
      'a[href$="/attendance"]'
    ).first().click();

    await page.getByRole('button', {
      name: 'Add lecture',
    }).click();

    await page.getByRole('button', {
      name: 'All present',
    }).click();

    await page.getByRole('button', {
      name: 'Save',
      exact: true,
    }).click();

    await expect(
      page.getByText(/Saved \d+ attendance mark/)
    ).toBeVisible({ timeout: 15000 });
  });

  test('enrolls a student by roll number (WRITES data)', async ({ page }) => {
    test.skip(
      !writes || !env.E2E_ENROLL_ROLL,
      'Writes data: set E2E_ALLOW_WRITES=yes and E2E_ENROLL_ROLL on a test database only.'
    );

    await loginFaculty(page);
    await openFirstCourse(page);

    await page.getByPlaceholder(/24BCE/).fill(
      env.E2E_ENROLL_ROLL!
    );

    await page.getByRole('button', {
      name: 'Enroll',
      exact: true,
    }).click();

    await expect(
      page.getByText(/Enrolled \d+/)
    ).toBeVisible({ timeout: 15000 });
  });
});
