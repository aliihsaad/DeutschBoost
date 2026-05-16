import React from 'react';
import { Link } from 'react-router-dom';

export const ExamSimulatorPage: React.FC = () => (
  <main className="db-dashboard" aria-label="Exam workspace">
    <section className="db-panel db-empty-workspace">
      <span className="db-section-label">Planned local module</span>
      <h1>Exam module is planned</h1>
      <p>
        Timed Goethe-style exams are not active in this build. The next local
        implementation pass needs real exam sessions, local scoring, and saved
        reports before this module returns to the main navigation.
      </p>
      <Link to="/practice" className="db-primary-button" role="button">
        Back to practice
      </Link>
    </section>
  </main>
);
