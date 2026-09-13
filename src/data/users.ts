export interface User {
  id: string;
  role: 'student' | 'faculty';
  rollNumber?: string;      // For students (e.g. 24BCE0480)
  facultyId?: string;       // For faculty (e.g. FAC001)
  password: string;         // Password (DOB for student or custom pwd for faculty)
  name: string;
  email: string;
  department: string;
  dateOfBirth?: string;     // YYYY-MM-DD format for students
  class?: string;           // For students
  subjects?: string[];      // For faculty
  avatarUrl?: string;
}

export const MOCK_USERS: User[] = [
  // --- STUDENTS ---
  {
    id: 'usr-std-001',
    role: 'student',
    rollNumber: '24BCE0480',
    dateOfBirth: '2005-06-15',
    password: '2005-06-15',
    name: 'Aarav Sharma',
    email: 'aarav.24bce0480@vit.ac.in',
    department: 'Computer Science & Engineering',
    class: 'CSE-101 (2024)',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-std-002',
    role: 'student',
    rollNumber: '24BCE2038',
    dateOfBirth: '2005-08-22',
    password: '2005-08-22',
    name: 'Priya Patel',
    email: 'priya.24bce2038@vit.ac.in',
    department: 'Computer Science & Engineering',
    class: 'CSE-102 (2024)',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-std-003',
    role: 'student',
    rollNumber: '24BCE2032',
    dateOfBirth: '2005-03-10',
    password: '2005-03-10',
    name: 'Rohan Verma',
    email: 'rohan.24bce2032@vit.ac.in',
    department: 'Electronics & Communication',
    class: 'ECE-201 (2024)',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-std-004',
    role: 'student',
    rollNumber: '24BCE1105',
    dateOfBirth: '2005-11-05',
    password: '2005-11-05',
    name: 'Ananya Iyer',
    email: 'ananya.24bce1105@vit.ac.in',
    department: 'Artificial Intelligence & Data Science',
    class: 'AI-301 (2024)',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-std-005',
    role: 'student',
    rollNumber: '24BCE0899',
    dateOfBirth: '2005-01-30',
    password: '2005-01-30',
    name: 'Vikram Singh',
    email: 'vikram.24bce0899@vit.ac.in',
    department: 'Computer Science & Engineering',
    class: 'CSE-101 (2024)',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  },

  // --- FACULTY ---
  {
    id: 'usr-fac-001',
    role: 'faculty',
    facultyId: 'FAC001',
    password: 'faculty@123',
    name: 'Dr. Ramesh Kumar',
    email: 'ramesh.kumar@vit.ac.in',
    department: 'Computer Science & Engineering',
    subjects: ['Database Management Systems', 'Operating Systems', 'Cloud Architecture'],
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-fac-002',
    role: 'faculty',
    facultyId: 'FAC002',
    password: 'faculty@456',
    name: 'Dr. Meena Swaminathan',
    email: 'meena.swaminathan@vit.ac.in',
    department: 'Artificial Intelligence & Data Science',
    subjects: ['Machine Learning', 'Deep Neural Networks', 'Natural Language Processing'],
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-fac-003',
    role: 'faculty',
    facultyId: 'FAC003',
    password: 'faculty@789',
    name: 'Prof. Rajesh Gupta',
    email: 'rajesh.gupta@vit.ac.in',
    department: 'Electronics & Communication',
    subjects: ['Computer Networks', 'Embedded Systems', 'Signal Processing'],
    avatarUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
  },
];

export const DEMO_CREDENTIALS = {
  students: [
    { rollNumber: '24BCE0480', dob: '2005-06-15', name: 'Aarav Sharma' },
    { rollNumber: '24BCE2038', dob: '2005-08-22', name: 'Priya Patel' },
    { rollNumber: '24BCE2032', dob: '2005-03-10', name: 'Rohan Verma' },
  ],
  faculty: [
    { facultyId: 'FAC001', password: 'faculty@123', name: 'Dr. Ramesh Kumar' },
    { facultyId: 'FAC002', password: 'faculty@456', name: 'Dr. Meena Swaminathan' },
  ],
};
