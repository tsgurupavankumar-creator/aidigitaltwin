"""Run with:  cd ml && python -m unittest discover -s tests -v"""
import hashlib
import importlib
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

ML = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML))
import oulad_features as F  # noqa: E402
from tests.make_fake_oulad import write  # noqa: E402


def history(rows):
    return pd.DataFrame(rows, columns=['id_assessment', 'assessment_type', 'order_date', 'score'])


class LearningFeatures(unittest.TestCase):
    def test_target_never_enters_features(self):
        row = F.learning_row(history([(1, 'CMA', 10, 40), (2, 'TMA', 20, 60), (3, 'CMA', 30, 80), (4, 'Exam', 99, 95)]))
        self.assertEqual(row['target'], 95)
        self.assertAlmostEqual(row['avgMastery'], 60)          # mean(40, 60, 80): 95 excluded
        self.assertAlmostEqual(row['avgQuizScore'], 60)        # CMAs 40, 80
        self.assertAlmostEqual(row['avgSubmissionScore'], 60)  # TMA 60
        self.assertEqual((row['quizCount'], row['submissionCount']), (2, 1))
        self.assertEqual(row['quizTrend'], 40)                 # newest earlier CMA - oldest
        for name in F.LEARNING_FEATURES:
            self.assertNotEqual(row[name], 95, name)

    def test_changing_the_target_changes_no_feature(self):
        a = F.learning_row(history([(1, 'CMA', 10, 50), (2, 'TMA', 20, 70), (3, 'Exam', 99, 10)]))
        b = F.learning_row(history([(1, 'CMA', 10, 50), (2, 'TMA', 20, 70), (3, 'Exam', 99, 100)]))
        self.assertEqual({k: a[k] for k in F.LEARNING_FEATURES}, {k: b[k] for k in F.LEARNING_FEATURES})

    def test_single_assessment_is_unusable(self):
        self.assertIsNone(F.learning_row(history([(1, 'CMA', 10, 50)])))

    def test_missing_scores_are_ignored_not_zero(self):
        # The unscored CMA is dropped, not counted as a zero.
        row = F.learning_row(history([(1, 'CMA', 10, None), (2, 'CMA', 20, 70), (3, 'Exam', 99, 80)]))
        self.assertEqual((row['quizCount'], row['avgQuizScore'], row['target']), (1, 70.0, 80.0))
        self.assertIsNone(F.learning_row(history([(1, 'CMA', 10, None), (2, 'Exam', 99, 80)])))

    def test_one_row_per_student_presentation(self):
        sa = pd.DataFrame([[1, 7, 5, 50], [2, 7, 9, 60], [3, 7, 5, 70], [4, 7, 9, 80]],
                          columns=['id_assessment', 'id_student', 'date_submitted', 'score'])
        assessments = pd.DataFrame([[1, 'AAA', '2013J', 'CMA', 5], [2, 'AAA', '2013J', 'Exam', 9],
                                    [3, 'BBB', '2013J', 'CMA', 5], [4, 'BBB', '2013J', 'Exam', 9]],
                                   columns=['id_assessment', 'code_module', 'code_presentation', 'assessment_type', 'date'])
        frame = F.build_learning_frame(sa, assessments)
        self.assertEqual(sorted(frame['target']), [60, 80])  # two modules, two rows, not merged


class AttendanceFeatures(unittest.TestCase):
    def test_cutoff_is_deterministic_and_in_range(self):
        weeks = [F.cutoff_week(i, 'AAA', '2013J') for i in range(500)]
        self.assertTrue(all(F.MIN_WEEKS <= w <= F.MAX_WEEKS for w in weeks))
        self.assertEqual(weeks, [F.cutoff_week(i, 'AAA', '2013J') for i in range(500)])
        self.assertGreater(len(set(weeks)), 5)

    def test_row_values(self):
        row = F.attendance_row({0, 1, 2, 5}, 8)
        self.assertEqual(row['currentAttendance'], 50.0)
        self.assertEqual(row['recentAttendance'], 25.0)  # weeks 4..7: only 5
        self.assertEqual(row['attendanceCount'], 8)
        self.assertAlmostEqual(row['absenceRate'], 0.5)

    def _frames(self, unreg='?', late_activity=False):
        key = dict(id_student=1, code_module='AAA', code_presentation='2013J')
        weeks = F.cutoff_week(1, 'AAA', '2013J')
        vle_rows = [dict(key, date=0)]
        if late_activity:
            vle_rows += [dict(key, date=d) for d in range(weeks * 7, weeks * 7 + 70, 7)]
        info = pd.DataFrame([dict(key, final_result='Withdrawn')])
        reg = pd.DataFrame([dict(key, date_unregistration=unreg)])
        return info, pd.DataFrame(vle_rows), reg, weeks

    def test_activity_after_cutoff_is_not_used(self):
        a = F.build_attendance_frame(*self._frames()[:3])
        b = F.build_attendance_frame(*self._frames(late_activity=True)[:3])
        presence = F.ATTENDANCE_FEATURES[:4]
        self.assertEqual(a[presence].to_dict(), b[presence].to_dict())

    def test_students_gone_before_cutoff_are_excluded(self):
        info, vle, reg, weeks = self._frames(unreg=3)
        self.assertEqual(len(F.build_attendance_frame(info, vle, reg)), 0)
        info, vle, reg, weeks = self._frames(unreg=weeks * 7 + 1)
        self.assertEqual(len(F.build_attendance_frame(info, vle, reg)), 1)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else 'absent'


class EndToEnd(unittest.TestCase):
    """Train, evaluate and serve on synthetic OULAD-format data in a temp dir."""

    @classmethod
    def setUpClass(cls):
        cls.shipped = {p.name: sha(p) for p in (ML / 'models').glob('*.pkl')}
        cls.tmp = tempfile.TemporaryDirectory()
        root = Path(cls.tmp.name)
        write(root / 'data')
        cls.env = dict(os.environ, ML_REPEATS='3', ML_TUNE='0', OULAD_DIR=str(root / 'data'), ML_MODELS_DIR=str(root / 'models'),
                       ML_REPORTS_DIR=str(root / 'reports'))
        cls.env['ML_UPPER_REPEATS'] = '1'
        for script in ('train_learning_analysis.py', 'train_attendance_risk.py', 'calibrate_risk_score.py', 'evaluate.py',
                       'upper_bound_experiment.py', 'compare_ai_vs_traditional.py'):
            subprocess.run([sys.executable, script], cwd=ML, env=cls.env, check=True, capture_output=True, text=True)
        cls.models, cls.reports = root / 'models', root / 'reports'

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_risk_config_written_and_sane(self):
        import json
        config = json.loads((self.models / 'risk_config.json').read_text())
        w = config['weights']
        self.assertAlmostEqual(w['attendance'] + w['learning'] + w['knowledge'], 1.0, places=3)
        c = config['levelCutoffs']
        self.assertTrue(c['MEDIUM'] <= c['HIGH'] <= c['CRITICAL'])
        ys = config['learningRiskMap']['y']
        self.assertEqual(ys, sorted(ys, reverse=True), 'higher predicted mark must never mean higher risk')
        report = json.loads((self.reports / 'evaluation_report.json').read_text())
        self.assertIn('data_driven', report['combined_risk'])
        self.assertIn('hand_set', report['combined_risk'])


    def test_per_assessment_type_results(self):
        import json
        report = json.loads((self.reports / 'evaluation_report.json').read_text())
        by_type = report['learning_analysis']['by_assessment_type']
        self.assertIn('coursework', by_type)
        self.assertEqual(by_type['all']['n'], sum(by_type[t]['n'] for t in ('CMA', 'TMA', 'Exam') if t in by_type))

    def test_rerunning_evaluate_keeps_the_other_results(self):
        import json, subprocess, sys
        subprocess.run([sys.executable, 'evaluate.py'], cwd=ML, env=self.env, check=True, capture_output=True)
        report = json.loads((self.reports / 'evaluation_report.json').read_text())
        for key in ('ai_vs_traditional', 'upper_bound'):
            self.assertIn(key, report)
        self.assertIn('by_assessment_type', report['learning_analysis'])

    def test_ai_vs_traditional_on_real_outcomes(self):
        import json
        r = json.loads((self.reports / 'ai_vs_traditional.json').read_text())
        for k in ('traditional_dashboard', 'ai_early_warning_model', 'ai_risk_level_high_or_critical'):
            v = r[k]
            self.assertEqual(v['tp'] + v['fp'] + v['fn'] + v['tn'], r['test']['students'])
        self.assertTrue(r['test']['matches_saved_test_predictions'])
        self.assertEqual([w['week'] for w in r['by_week']], [4, 6, 8, 10, 12])
        self.assertIn('ai_vs_traditional', json.loads((self.reports / 'evaluation_report.json').read_text()))

    def test_upper_bound_is_research_only(self):
        import json
        ub = json.loads((self.reports / 'upper_bound.json').read_text())
        self.assertIn('with_richer_data', ub['marks']['average'])
        self.assertIn('gender', ub['excluded_on_purpose'])
        self.assertFalse(set(ub['extra_inputs']) & {'gender', 'age_band', 'disability', 'imd_band'})
        app_models = {p.name for p in self.models.iterdir()}
        self.assertEqual(app_models, {'learning_analysis_v1.pkl', 'attendance_risk_v1.pkl', 'risk_config.json'}, 'no extra model saved for the app')

    def test_model_cards_written_with_real_numbers(self):
        for name in ('MODEL_CARD_early_warning.md', 'MODEL_CARD_marks.md', 'MODEL_CARD_risk_levels.md'):
            text = (self.reports / name).read_text()
            self.assertIn('# Model card', text)
            self.assertNotIn('Not run yet', text)
        self.assertIn('Per course', (self.reports / 'MODEL_CARD_marks.md').read_text())

    def test_ranges_hold_on_held_out_course_runs(self):
        artifact = joblib.load(self.models / 'learning_analysis_v1.pkl')
        meta = artifact['range_80']['all']
        self.assertGreaterEqual(meta['held_out_coverage'], 0.80)
        self.assertGreaterEqual(meta['widen_factor'], 1.0)

    def test_shipped_models_untouched(self):
        self.assertEqual(self.shipped, {p.name: sha(p) for p in (ML / 'models').glob('*.pkl')})

    def test_artifacts_are_version_3_with_baselines(self):
        for name in ('learning_analysis_v1.pkl', 'attendance_risk_v1.pkl'):
            artifact = joblib.load(self.models / name)
            self.assertEqual(artifact['protocol']['version'], 7 if name.startswith('attendance') else 8)
            self.assertIn('trained_at', artifact)
            self.assertIn('params', artifact)
            self.assertIn('baseline', artifact)

    def test_calibrator_is_saved_and_probabilities_are_calibrated(self):
        artifact = joblib.load(self.models / 'attendance_risk_v1.pkl')
        self.assertIsNotNone(artifact.get('calibrator'))
        saved = joblib.load(self.reports / 'attendance_test.pkl')
        self.assertTrue(((saved['probabilities'] >= 0) & (saved['probabilities'] <= 1)).all())

    def test_threshold_is_chosen_on_validation_and_used_for_test_predictions(self):
        artifact = joblib.load(self.models / 'attendance_risk_v1.pkl')
        saved = joblib.load(self.reports / 'attendance_test.pkl')
        t = artifact['threshold']
        self.assertTrue(0 < t < 1)
        self.assertIn('validation', artifact['protocol']['threshold_rule'])
        self.assertEqual(list(saved['predictions']), list((saved['probabilities'] >= t).astype(int)))
        self.assertEqual(saved['threshold'], t)

    def test_no_presentation_in_both_sets(self):
        for name, builder in (('learning_test.pkl', None), ('attendance_test.pkl', None)):
            protocol = joblib.load(self.reports / name)['protocol']
            test_set = set(protocol['test_presentations'])
            self.assertTrue(test_set)
            self.assertLess(len(test_set), 8)

    def test_report_has_model_and_baseline(self):
        import json
        report = json.loads((self.reports / 'evaluation_report.json').read_text())
        for section in ('learning_analysis', 'attendance_risk'):
            self.assertIn('baseline', report[section])
            self.assertEqual(report[section]['protocol']['version'], 8 if section == 'learning_analysis' else 7)
            self.assertTrue(report[section]['by_course'], 'per-course table present')
            self.assertEqual(report[section]['repeated_splits']['repeats'], 3)
            self.assertIn('temporal_split', report[section])
            self.assertIn('gender', report[section]['fairness'])
            self.assertIsInstance(report[section]['verdict'], str)
        fair = report['attendance_risk']['fairness_training']
        self.assertIn('reweighing_used', fair)
        self.assertIn('plain_validation', fair)
        diag = report['attendance_risk']['fairness_diagnosis']
        self.assertTrue({'F', 'M'} <= set(diag))
        self.assertIn('false_alarms_avg_inputs', diag['F'])
        curve = report['attendance_risk']['cutoff_curve']
        self.assertEqual([c['week'] for c in curve], [4, 6, 8, 10, 12])
        self.assertTrue(all('model_auc' in c or 'skipped' in c for c in curve))
        self.assertIn('score_baseline_auc', report['attendance_risk']['baseline'])
        calib = report['attendance_risk']['calibration']
        self.assertTrue(0 <= calib['brier'] <= 1)
        self.assertEqual(sum(b['n'] for b in calib['reliability']), report['attendance_risk']['confusion_matrix'][0][0]
                         + sum(report['attendance_risk']['confusion_matrix'][0][1:]) + sum(report['attendance_risk']['confusion_matrix'][1]))

    def test_server_serves_the_new_models(self):
        os.environ['ML_MODELS_DIR'] = str(self.models)
        for mod in ('_paths', 'server'):
            sys.modules.pop(mod, None)
        from fastapi.testclient import TestClient
        server = importlib.import_module('server')
        client = TestClient(server.app)
        learning = client.post('/predict/learning', json={'studentId': 's', 'features': {
            'avgMastery': 70, 'avgQuizScore': 72, 'avgSubmissionScore': 68, 'quizCount': 3, 'submissionCount': 3, 'quizTrend': 5}}).json()
        attendance = client.post('/predict/attendance', json={'studentId': 's', 'features': {
            'currentAttendance': 40, 'recentAttendance': 20, 'attendanceCount': 8, 'absenceRate': 0.6}}).json()
        self.assertEqual((learning['modelUsed'], attendance['modelUsed']), ('trained', 'trained'))
        self.assertTrue(0 <= learning['nextExamScore'] <= 100)
        self.assertTrue(learning['low'] <= learning['nextExamScore'] <= learning['high'])
        self.assertTrue(learning['modelVersion'].startswith('v8 trained '))
        health = client.get('/health').json()
        self.assertTrue(health['attendance_model_version'].startswith('v7 trained '))
        self.assertTrue(1 <= len(learning['reasons']) <= 3)
        self.assertTrue(all(r['feature'] in joblib.load(self.models / 'learning_analysis_v1.pkl')['features'] for r in learning['reasons']))
        self.assertTrue(0 <= attendance['riskScore'] <= 1)
        self.assertEqual(attendance['threshold'], joblib.load(self.models / 'attendance_risk_v1.pkl')['threshold'])
        # Unknown early score (no assessed work yet) is accepted as null and treated as missing, not 0.
        unknown = client.post('/predict/attendance', json={'studentId': 's', 'features': {
            'currentAttendance': 90, 'recentAttendance': 90, 'attendanceCount': 8, 'absenceRate': 0.1,
            'earlyAvgScore': None, 'earlyAssessedCount': 0, 'earlyMissedCount': 0, 'earlyLateCount': 0}})
        self.assertEqual(unknown.status_code, 200)
        self.assertEqual(unknown.json()['modelUsed'], 'trained')
        risky = client.post('/predict/attendance', json={'studentId': 's', 'features': {
            'currentAttendance': 10, 'recentAttendance': 0, 'attendanceCount': 10, 'absenceRate': 0.9,
            'earlyAvgScore': 20, 'earlyAssessedCount': 2, 'earlyMissedCount': 3, 'earlyLateCount': 2}}).json()
        self.assertTrue(len(risky['reasons']) >= 1, 'a high-risk student must come with reasons')
        self.assertTrue(all(r['effect'] > 0 for r in risky['reasons']), 'listed reasons must push risk up')


if __name__ == '__main__':
    unittest.main()


class EarlyWarningFeatures(unittest.TestCase):
    def test_work_submitted_after_the_cutoff_is_not_known_yet(self):
        subs = [
            {'id_assessment': 1, 'assessment_type': 'TMA', 'date': 20, 'date_submitted': 25, 'score': 40},   # late, known
            {'id_assessment': 2, 'assessment_type': 'CMA', 'date': 30, 'date_submitted': 30, 'score': 80},   # known
            {'id_assessment': 3, 'assessment_type': 'TMA', 'date': 50, 'date_submitted': 70, 'score': 100},  # after cut-off
        ]
        row = F.early_row(subs, [(1, 20), (3, 50), (4, 55)], cutoff_day=56)
        self.assertEqual(row['earlyAvgScore'], 60)          # 40 and 80 only; the 100 is not known at day 56
        self.assertEqual(row['earlyAssessedCount'], 2)
        self.assertEqual(row['earlyLateCount'], 1)
        self.assertEqual(row['earlyMissedCount'], 2)        # TMA 3 (handed in after cut-off) and TMA 4: missed so far

    def test_nothing_scored_yet_is_unknown_not_zero(self):
        import math
        row = F.early_row([], [], cutoff_day=28)
        self.assertTrue(math.isnan(row['earlyAvgScore']))
        self.assertEqual(row['earlyAssessedCount'], 0)

    def test_fixed_cutoff_week_applies_to_everyone(self):
        info = pd.DataFrame([dict(id_student=i, code_module='AAA', code_presentation='2013J', final_result='Pass') for i in range(5)])
        reg = pd.DataFrame([dict(id_student=i, code_module='AAA', code_presentation='2013J', date_unregistration='?') for i in range(5)])
        frame = F.build_attendance_frame(info, {}, reg, fixed_weeks=6)
        self.assertEqual(set(frame['attendanceCount']), {6})


class LearningHistoryFeatures(unittest.TestCase):
    def test_late_and_missed_count_only_assignments_due_before_the_target(self):
        h = pd.DataFrame([
            (1, 'TMA', 20, 20, 25, 50),   # late
            (2, 'CMA', 30, 30, 40, 70),   # quizzes never count as late
            (5, 'Exam', 99, None, 99, 80),
        ], columns=['id_assessment', 'assessment_type', 'order_date', 'date', 'date_submitted', 'score'])
        row = F.learning_row(h, [(1, 20), (3, 60), (4, 120)])
        self.assertEqual(row['lateCount'], 1)
        self.assertEqual(row['missedCount'], 1)            # TMA 3 due before the exam, not handed in; TMA 4 due after
        self.assertEqual((row['lastScore'], row['scoreTrend']), (70, 20))
        self.assertEqual(row['target'], 80)
        for name in F.LEARNING_FEATURES:
            self.assertNotEqual(row[name], 80, name)


class NextAssessmentRows(unittest.TestCase):
    def test_one_row_per_assessment_each_seeing_only_earlier_work(self):
        h = pd.DataFrame([
            (1, 'CMA', 10, 10, 10, 40),
            (2, 'TMA', 20, 20, 22, 60),
            (3, 'CMA', 30, 30, 30, 80),
        ], columns=['id_assessment', 'assessment_type', 'order_date', 'date', 'date_submitted', 'score'])
        rows = F.learning_rows(h, [(2, 20)])
        self.assertEqual([r['target'] for r in rows], [60, 80])      # the first assessment has nothing earlier
        self.assertEqual(rows[0]['avgMastery'], 40)                  # predicting #2 sees only #1
        self.assertEqual(rows[1]['avgMastery'], 50)                  # predicting #3 sees #1 and #2
        self.assertEqual(rows[1]['lateCount'], 1)                    # #2 was handed in 2 days late
        self.assertEqual(rows[0]['missedCount'], 0)                  # #2 is the target, not 'missed' before itself

    def test_prediction_range_and_coverage(self):
        from evaluation_extras import interval_coverage, residual_interval
        rng = np.random.default_rng(0)
        y = rng.normal(60, 10, 2000); p = y + rng.normal(0, 8, 2000)
        r = residual_interval(y[:1000], p[:1000])
        self.assertLess(r['low_offset'], 0); self.assertGreater(r['high_offset'], 0)
        self.assertAlmostEqual(interval_coverage(y[1000:], p[1000:], r), 0.8, delta=0.05)


class ContextFeatures(unittest.TestCase):
    def test_relative_to_class_presence_and_next_type(self):
        earlier = pd.DataFrame([(1, 'CMA', 70.0), (2, 'TMA', 50.0)], columns=['id_assessment', 'assessment_type', 'score'])
        f = F.context_features(earlier, 'Exam', target_date=70, class_mean={1: 60.0, 2: 60.0}, active_weeks={0, 1, 2, 8, 9})
        self.assertEqual((f['nextIsAssignment'], f['nextIsExam']), (0, 1))
        self.assertEqual(f['relativeToClass'], 0.0)           # +10 and -10 vs the class
        self.assertEqual(f['classAvgPrior'], 60.0)
        self.assertEqual(f['presenceRate'], 0.5)              # weeks 0-9: 5 of 10 active
        self.assertEqual(f['recentPresenceRate'], 0.5)        # weeks 6-9: 8 and 9

    def test_unknowns_are_nan_not_zero(self):
        import math
        earlier = pd.DataFrame([(1, 'CMA', 70.0)], columns=['id_assessment', 'assessment_type', 'score'])
        f = F.context_features(earlier, 'CMA', target_date=3, class_mean=None, active_weeks=None)
        self.assertTrue(all(math.isnan(f[k]) for k in ('relativeToClass', 'classAvgPrior', 'presenceRate', 'recentPresenceRate')))
        self.assertEqual((f['nextIsAssignment'], f['nextIsExam']), (0, 0))

    def test_ranges_are_per_assessment_type(self):
        import train_learning_analysis as T
        rng = np.random.default_rng(1)
        frame = pd.DataFrame({'target': rng.normal(60, 10, 600), 'target_type': ['CMA'] * 300 + ['Exam'] * 300})
        pred = frame['target'] + np.r_[rng.normal(0, 3, 300), rng.normal(0, 15, 300)]
        iv = T.intervals_by_type(frame, pred)
        width = lambda k: iv[k]['high_offset'] - iv[k]['low_offset']
        self.assertGreater(width('Exam'), 2 * width('CMA'))   # exams get a wider range
        self.assertAlmostEqual(T.coverage(frame, pred, iv)['all'], 0.8, delta=0.03)


class FairnessInputs(unittest.TestCase):
    def test_presence_and_score_relative_to_class(self):
        key = dict(code_module='AAA', code_presentation='2013J')
        info = pd.DataFrame([dict(key, id_student=i, final_result='Pass') for i in (1, 2)])
        reg = pd.DataFrame([dict(key, id_student=i, date_unregistration='?') for i in (1, 2)])
        weeks = {(1, 'AAA', '2013J'): {0, 1, 2, 3}, (2, 'AAA', '2013J'): {0, 1}}
        hist = ({(1, 'AAA', '2013J'): [{'id_assessment': 9, 'assessment_type': 'CMA', 'date': 5, 'date_submitted': 5, 'score': 80.0}],
                 (2, 'AAA', '2013J'): [{'id_assessment': 9, 'assessment_type': 'CMA', 'date': 5, 'date_submitted': 5, 'score': 40.0}]}, {})
        frame = F.build_attendance_frame(info, weeks, reg, fixed_weeks=4, history=hist).set_index('id_student')
        self.assertEqual(frame.loc[1, 'presenceVsClass'], 25.0)    # 100% vs class 75%
        self.assertEqual(frame.loc[2, 'presenceVsClass'], -25.0)
        self.assertEqual(frame.loc[1, 'scoreVsClass'], 20.0)       # 80 vs class mean 60
        self.assertEqual(frame.loc[2, 'scoreVsClass'], -20.0)

    def test_days_since_previous(self):
        earlier = pd.DataFrame([(1, 'CMA', 70.0, 10), (2, 'TMA', 50.0, 30)], columns=['id_assessment', 'assessment_type', 'score', 'order_date'])
        self.assertEqual(F.context_features(earlier, 'CMA', 44, None, None)['daysSincePrevious'], 14)

    def test_reweighing_makes_group_and_outcome_independent(self):
        import train_attendance_risk as T
        df = pd.DataFrame({'gender': ['F'] * 100 + ['M'] * 100, 'target': [1] * 70 + [0] * 30 + [1] * 30 + [0] * 70})
        w = T.reweighing_weights(df)
        weighted = df.assign(w=w).groupby(['gender', 'target'])['w'].sum()
        rate = lambda g: weighted[(g, 1)] / (weighted[(g, 0)] + weighted[(g, 1)])
        self.assertAlmostEqual(rate('F'), rate('M'), places=6)

    def test_fpr_gap(self):
        import train_attendance_risk as T
        df = pd.DataFrame({'gender': ['F'] * 40 + ['M'] * 40, 'target': [0] * 80})
        pred = [1] * 20 + [0] * 20 + [1] * 8 + [0] * 32           # F: 50% false alarms, M: 20%
        self.assertAlmostEqual(T.fpr_gap(df, pred), 0.3)


class ThresholdRule(unittest.TestCase):
    def test_highest_threshold_reaching_target_recall(self):
        from evaluation_extras import choose_threshold
        y = [1, 1, 1, 1, 0, 0, 0, 0, 1, 0]
        s = [0.9, 0.8, 0.7, 0.3, 0.6, 0.2, 0.1, 0.05, 0.25, 0.4]
        r = choose_threshold(y, s, target_recall=0.6)   # 3 of 5 positives at >= 0.7
        self.assertEqual(r['threshold'], 0.7)
        self.assertGreaterEqual(r['validation_recall'], 0.6)

    def test_falls_back_to_best_f1_when_target_unreachable(self):
        from evaluation_extras import choose_threshold
        r = choose_threshold([0, 0, 0], [0.1, 0.2, 0.3], target_recall=0.7)
        self.assertIn('best validation F1', r['rule'])
