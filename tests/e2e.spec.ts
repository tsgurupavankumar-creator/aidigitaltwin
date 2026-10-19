import { test, expect } from '@playwright/test';

const studentRoll = process.env.E2E_STUDENT_ROLL;
const studentDob = process.env.E2E_STUDENT_DOB;
const studentPassword = process.env.E2E_STUDENT_PASSWORD;

test('student can sign in and see the weekly review action', async ({ page }) => {
  test.skip(
    !studentRoll || !studentDob || !studentPassword,
    'Set E2E_STUDENT_ROLL, E2E_STUDENT_DOB, and E2E_STUDENT_PASSWORD for an enrolled test account.'
  );

  await page.goto('/login/student');
  await page.locator('#student-roll-number').fill(studentRoll!);
  await page.locator('#student-dob').fill(studentDob!);
  await page.locator('input[type="password"]').fill(studentPassword!);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/student(?:\?.*)?$/);
  await expect(page.getByRole('button', { name: 'RUN WEEKLY REVIEW' })).toBeVisible();
});
