
import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';

const env = process.env;

const enabled = Boolean(
  env.E2E_STUDENT_ROLL &&
  env.E2E_STUDENT_DOB &&
  env.E2E_STUDENT_PASSWORD &&
  env.E2E_ALLOW_WRITES === 'yes' &&
  env.E2E_PARSER_READY === 'yes'
);

test.skip(
  !enabled,
  'Requires an enrolled student, writable test database, and running FastAPI parser.'
);

test('student uploads syllabus and generates a five-question quiz', async ({ page }) => {
  const consoleErrors: string[] = [];
  let loginRequestSent = false;
  let loginStatus: number | null = null;
  let loginError = '';

 page.on('pageerror', error => {
  consoleErrors.push(error.message);

  console.log('\n=== UNCAUGHT PAGE ERROR ===');
  console.log('MESSAGE:', error.message);
  console.log('STACK:', error.stack || 'No stack available');
});

page.on('requestfailed', request => {
  console.log('\n=== FAILED REQUEST ===');
  console.log('URL:', request.url());
  console.log('ERROR:', request.failure()?.errorText);
});
  // STEP 1: STUDENT LOGIN

  await page.goto('/login/student');

  // Wait until React's event handlers are active
const showPassword = page.getByRole('button', {
  name: 'Show password'
});

await showPassword.click();

await expect(
  page.getByRole('button', { name: 'Hide password' })
).toBeVisible({ timeout: 15000 });

await expect(
  page.locator('input[type="text"]').last()
).toBeVisible();

await page.getByRole('button', {
  name: 'Hide password'
}).click();

await expect(
  page.getByRole('button', { name: 'Show password' })
).toBeVisible();

  // Verify that React has hydrated the login form
const passwordField = page.locator('input[type="password"]');

await page.getByRole('button', { name: 'Show password' }).click();

await expect(
  page.locator('input[type="text"]').last()
).toBeVisible();

await page.getByRole('button', { name: 'Hide password' }).click();

await expect(passwordField).toBeVisible();

  await page.locator('#student-roll-number').fill(env.E2E_STUDENT_ROLL!);
  await page.locator('#student-dob').fill(env.E2E_STUDENT_DOB!);
  await page.locator('input[type="password"]').fill(env.E2E_STUDENT_PASSWORD!);

  console.log('\n========== LOGIN DIAGNOSTICS ==========');
  console.log(
    'DOB:',
    await page.locator('#student-dob').inputValue()
  );
  console.log(
    'PASSWORD ENTERED:',
    (await page.locator('input[type="password"]').inputValue()).length > 0
  );

  page.on('request', request => {
    if (request.url().includes('/api/auth/login/student')) {
      loginRequestSent = true;
      console.log('LOGIN REQUEST SENT:', request.method());
    }
  });

  page.on('response', async response => {
    if (response.url().includes('/api/auth/login/student')) {
      loginStatus = response.status();
      console.log('LOGIN HTTP STATUS:', response.status());

      try {
        const body = await response.json();
        loginError = body?.error || body?.code || '';

        console.log('LOGIN RESULT:', {
          success: body?.success,
          code: body?.code,
          error: body?.error
        });
      } catch {
        console.log('LOGIN RESPONSE: Not JSON');
      }
    }
  });

  await page.getByRole('button', { name: 'Sign In' }).click();

  try {
    await expect.poll(
      async () => {
        const path = new URL(page.url()).pathname;

        if (path === '/student') {
          return 'LOGGED_IN';
        }

        const text = await page.locator('body').innerText();

        if (
          /Invalid credentials|Roll number must|Unable to sign in|Authentication failed|Please enter|account.*(?:locked|suspended)/i.test(text)
        ) {
          return 'LOGIN_ERROR';
        }

        return 'WAITING';
      },
      { timeout: 15000, intervals: [250, 500, 1000] }
    ).not.toBe('WAITING');
  } catch {
    console.log('LOGIN CHECK TIMED OUT');
  }

  console.log('LOGIN REQUEST DETECTED:', loginRequestSent);
  console.log('LOGIN STATUS:', loginStatus);
  console.log('FINAL URL:', page.url());
  console.log(
    'VISIBLE PAGE:',
    (await page.locator('body').innerText()).slice(0, 1500)
  );
  console.log('=======================================');

  const currentPath = new URL(page.url()).pathname;

  if (currentPath !== '/student') {
    throw new Error(
      'Student login did not reach the dashboard. ' +
      `Request sent: ${loginRequestSent}. ` +
      `HTTP status: ${loginStatus ?? 'none'}. ` +
      `Error: ${loginError || 'Check VISIBLE PAGE output above.'}`
    );
  }

  console.log('\nSTUDENT LOGIN SUCCESSFUL');

  // STEP 2: OPEN QUIZ WIZARD

  consoleErrors.length = 0;
  await page.goto('/student/quizzes/new');
  await page.waitForLoadState('domcontentloaded');

  console.log('\nWIZARD URL:', page.url());

  const courseSelector = page.getByLabel('Enrolled course');

  try {
    await expect(courseSelector).toBeVisible({ timeout: 10000 });
  } catch (error) {
    console.log('\n========== WIZARD DIAGNOSTICS ==========');
    console.log('CURRENT URL:', page.url());

    console.log(
      'PAGE CONTENT:',
      (await page.locator('body').innerText()).slice(0, 3000)
    );

    console.log(
      'AVAILABLE DROPDOWNS:',
      JSON.stringify(
        await page.locator('select').evaluateAll(elements =>
          elements.map(element => ({
            id: element.id,
            name: element.getAttribute('name'),
            labels: Array.from(
              (element as HTMLSelectElement).labels || []
            ).map(label => label.textContent?.trim()),
            options: Array.from(
              (element as HTMLSelectElement).options
            ).map(option => option.text)
          }))
        ),
        null,
        2
      )
    );

    console.log('========================================');
    throw error;
  }

  const optionCount = await courseSelector.locator('option').count();

  expect(optionCount).toBeGreaterThan(1);

  await courseSelector.selectOption({ index: 1 });

  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // STEP 3: UPLOAD SYLLABUS PDF

  await page.locator('#syllabus-pdf').setInputFiles(
    resolve('tests/fixtures/sample-syllabus.pdf')
  );

  await page.getByRole('button', { name: 'Upload syllabus' }).click();

  await expect(
    page.getByText(/Syllabus ready/i)
  ).toBeVisible({ timeout: 45000 });

  console.log('SYLLABUS UPLOAD SUCCESSFUL');

  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // STEP 4: SELECT FIVE TOPICS

  const modules = page.locator('fieldset').filter({
    has: page.locator('legend')
  });

  await expect(modules).toHaveCount(5, { timeout: 15000 });

  const topicCounts = [3, 2];

  for (let i = 0; i < 2; i++) {
    const module = modules.nth(i);
    const checkboxes = module.locator('input[type="checkbox"]');

    const count = await checkboxes.count();

    expect(count).toBeGreaterThan(topicCounts[i]);

    for (let j = 1; j <= topicCounts[i]; j++) {
      await checkboxes.nth(j).check();
    }
  }

  console.log('FIVE TOPICS SELECTED');

  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // STEP 5: CONFIGURE QUIZ

  await page.getByRole('button', { name: 'Quick 5' }).click();

  await page.getByRole('button', {
    name: 'mixed',
    exact: true
  }).click();

  await expect(page.getByLabel('Multiple choice')).toBeChecked();
  await expect(page.getByLabel('True / false')).toBeChecked();
  await expect(page.getByLabel('Short answer')).toBeChecked();
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // STEP 6: REVIEW AND GENERATE

// STEP 6: REVIEW AND GENERATE

console.log('\n========== REVIEW PAGE ==========');
console.log('CURRENT URL:', page.url());
console.log(
  'PAGE CONTENT:',
  (await page.locator('body').innerText()).slice(0, 5000)
);
console.log(
  'BUTTONS:',
  await page.getByRole('button').allTextContents()
);
console.log('=================================');

await expect(
  page.getByText(/Selected topics:\s*5/i)
).toBeVisible();

  await page.getByRole('button', {
    name: 'Generate Quiz'
  }).click();

  // STEP 7: VERIFY GENERATED QUIZ

await expect(page).toHaveURL(
  /\/student\/quizzes\/[^/?]+(?:\?.*)?$/,
  { timeout: 45000 }
);

await expect(
  page.getByRole('heading', {
    name: /Personalized syllabus quiz/i
  })
).toBeVisible({ timeout: 20000 });

await expect(
  page.locator('span.font-mono')
    .filter({ hasText: /questions/ })
    .first()
).toContainText('5 questions', { timeout: 20000 });

const applicationErrors = consoleErrors.filter(
  error => !error.includes('__nextjs_original-stack-frames')
);

console.log('Uncaught page errors:', applicationErrors);

console.log('\nQUIZ WIZARD TEST PASSED');
});