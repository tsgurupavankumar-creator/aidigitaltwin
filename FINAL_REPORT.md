# Final Report: v21 Release

## Project Evaluation

The v21 release establishes the project as a complete Digital Twin according to the education definition: it maintains an evolving, data-grounded representation of a learner and uses that representation to support understanding and timely academic decisions. The twin represents eight dimensions of academic health: academic health, performance, attendance, engagement, knowledge, behavior, skills, and learning velocity. In particular, engagement, behavior, skills, and learning velocity are no longer fixed seed values. They are calculated dynamically from recorded student actions and outcomes, including attendance, assignment submissions, quiz attempts, and demonstrated concept mastery. As new records are entered, the twin and its associated risk and learning analyses are recalculated.

The release also evaluates the twin longitudinally. A snapshot is saved for each completed twin update, preserving the learner's academic health and risk state over time. Students and faculty can inspect a trajectory chart to see how academic health and risk develop as new attendance, assessment, and submission data are recorded. This history makes changes visible rather than presenting the twin as a single, static score.

The What-If Simulator provides a complementary way to explore possible outcomes without changing the student's saved record. A user can, for example, change the scenario attendance rate to 90% and receive an updated risk level and predicted marks range from the same trained ML models used by the system. These predictions are returned in real time when the trained model service is available, and the interface presents the baseline alongside the simulated outcome and its assumptions.

## System Architecture

The system combines student records maintained in the application database with an event-driven twin synchronization and analysis pipeline. Attendance changes, submissions, grades, and quiz attempts trigger the pipeline, which recalculates the twin dimensions and runs the relevant risk and learning analyses. The eight-dimension state brings together academic health, performance, attendance, engagement, knowledge, behavior, skills, and learning velocity; its action-derived measures are computed from the student's actual records rather than populated as fixed seed values.

After a completed synchronization, the system stores a dated snapshot containing the twin state and its associated risk information. Student and faculty interfaces retrieve this history and render a trajectory chart, enabling both audiences to review academic health and risk over time. Separately, the What-If Simulator applies proposed changes to the model inputs and sends the scenario through the trained ML models to return the predicted risk and marks range. Simulation is advisory and does not write the hypothetical inputs back to the student's record.

The architecture deliberately retains a human-in-the-loop decision model: AI suggests, faculty decides. Model outputs and risk indicators inform professional judgment, but they do not autonomously determine interventions or replace faculty responsibility. This is a deliberate ethical choice that keeps educational decisions accountable to the people who know the student's context.

## Conclusion

The v21 release moves the platform beyond a static dashboard by connecting real student activity to a multidimensional, continuously updated learner representation, preserving its trajectory through snapshots, and supporting forward-looking exploration with trained-model simulations. The project is now a complete Digital Twin according to the education definition. Its design pairs data-driven analysis with human oversight so that AI recommendations support, rather than displace, faculty judgment.

Stage 2 should address two remaining limitations before broader institutional claims are made. At present, student information is entered by faculty rather than imported automatically from campus ERP systems; future work should establish secure, reliable integrations with those institutional sources. The system also needs validation with a real student cohort to evaluate the accuracy, calibration, usefulness, and fairness of its dimensions and predictions in an authentic educational setting.
