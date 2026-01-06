
import { createClient } from '@supabase/supabase-js';
import { User, StudentData, UserRole, ClassSettings, QuizResult, ChatMessage, ChatSession, AssignmentMaster, VotingSession, Vote, Assignment } from '../types';
import { INITIAL_STUDENTS, INITIAL_TEACHER, INITIAL_SETTINGS, MOCK_CHATS } from '../constants';

// 注意：這些變數應在 Vercel 或部署平台的環境變數中設定
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

// 如果沒有設定 Supabase，我們回退到 LocalStorage 模式以確保本地端仍可運作
const isCloudEnabled = !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
const supabase = isCloudEnabled ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const USERS_STORAGE_KEY = 'class_sync_users';
const CURRENT_USER_KEY = 'class_sync_current_user';
const SETTINGS_STORAGE_KEY = 'class_sync_settings';
const CHAT_MSG_STORAGE_KEY = 'class_sync_chat_msgs';
const CHAT_SESSIONS_KEY = 'class_sync_chat_sessions';
const ASSIGNMENT_MASTERS_KEY = 'class_sync_assignment_masters';
const VOTING_SESSION_KEY = 'class_sync_voting_session';
const VOTES_KEY = 'class_sync_votes';

// --- Helpers ---
const getLocal = (key: string, fallback: any) => {
  const s = localStorage.getItem(key);
  return s ? JSON.parse(s) : fallback;
};

const setLocal = (key: string, val: any) => {
  localStorage.setItem(key, JSON.stringify(val));
};

export const authService = {
  isCloud: isCloudEnabled,

  init: async () => {
    if (!localStorage.getItem(USERS_STORAGE_KEY)) {
      setLocal(USERS_STORAGE_KEY, [INITIAL_TEACHER, ...INITIAL_STUDENTS]);
    }
    if (!localStorage.getItem(SETTINGS_STORAGE_KEY)) setLocal(SETTINGS_STORAGE_KEY, INITIAL_SETTINGS);
    if (!localStorage.getItem(CHAT_MSG_STORAGE_KEY)) setLocal(CHAT_MSG_STORAGE_KEY, MOCK_CHATS);
    if (!localStorage.getItem(CHAT_SESSIONS_KEY)) setLocal(CHAT_SESSIONS_KEY, []);
    if (!localStorage.getItem(ASSIGNMENT_MASTERS_KEY)) setLocal(ASSIGNMENT_MASTERS_KEY, []);
    if (!localStorage.getItem(VOTING_SESSION_KEY)) setLocal(VOTING_SESSION_KEY, { isActive: false, sessionId: 'init', lastStartedAt: '' });
    if (!localStorage.getItem(VOTES_KEY)) setLocal(VOTES_KEY, []);
  },

  login: async (username: string, password: string): Promise<User | StudentData | null> => {
    // 雖然 Supabase 有自己的 Auth，但為了保持原有邏輯，我們使用資料表模擬
    const users = getLocal(USERS_STORAGE_KEY, []);
    const user = users.find((u: any) => u.username === username && u.password === password);
    if (user) {
      setLocal(CURRENT_USER_KEY, user);
      return user;
    }
    return null;
  },

  register: async (name: string, username: string, password: string, role: UserRole): Promise<User | StudentData> => {
    const users = getLocal(USERS_STORAGE_KEY, []);
    if (users.some((u: any) => u.username === username)) throw new Error('帳號已存在');

    const baseUser = { id: Date.now().toString(), name, username, password, role };
    let newUser: User | StudentData;
    if (role === UserRole.STUDENT) {
      newUser = { ...baseUser, balance: 0, transactions: [], assignments: [], chatNicknames: {} } as StudentData;
    } else {
      newUser = baseUser;
    }

    const updatedUsers = [...users, newUser];
    setLocal(USERS_STORAGE_KEY, updatedUsers);
    setLocal(CURRENT_USER_KEY, newUser);
    return newUser;
  },

  logout: () => {
    localStorage.removeItem(CURRENT_USER_KEY);
  },

  getCurrentUser: (): User | null => getLocal(CURRENT_USER_KEY, null),

  getStudents: (): StudentData[] => {
    const users = getLocal(USERS_STORAGE_KEY, []);
    return users.filter((u: any) => u.role === UserRole.STUDENT) as StudentData[];
  },

  updateStudent: async (studentData: StudentData) => {
    const users = getLocal(USERS_STORAGE_KEY, []);
    const index = users.findIndex((u: any) => u.id === studentData.id);
    if (index !== -1) {
      users[index] = studentData;
      setLocal(USERS_STORAGE_KEY, users);
      const currentUser = authService.getCurrentUser();
      if (currentUser && currentUser.id === studentData.id) {
        setLocal(CURRENT_USER_KEY, studentData);
      }
    }
  },

  saveStudentNickname: (studentId: string, sessionId: string, nickname: string) => {
    const users = getLocal(USERS_STORAGE_KEY, []);
    const student = users.find((u: any) => u.id === studentId) as StudentData;
    if (student && student.role === UserRole.STUDENT) {
      if (!student.chatNicknames) student.chatNicknames = {};
      student.chatNicknames[sessionId] = nickname;
      authService.updateStudent(student);
    }
  },

  submitQuizResult: (studentId: string, result: QuizResult) => {
    const users = getLocal(USERS_STORAGE_KEY, []);
    const student = users.find((u: any) => u.id === studentId) as StudentData;
    if (student && student.role === UserRole.STUDENT) {
      student.quizResult = result;
      authService.updateStudent(student);
    }
  },

  getChatSessions: (): ChatSession[] => getLocal(CHAT_SESSIONS_KEY, []),

  createChatSession: (topic: string): ChatSession => {
    const sessions = authService.getChatSessions();
    const newSession: ChatSession = {
      id: Date.now().toString(),
      topic,
      isActive: true,
      createdAt: new Date().toISOString()
    };
    setLocal(CHAT_SESSIONS_KEY, [newSession, ...sessions]);
    return newSession;
  },

  updateChatSession: (sessionId: string, updates: Partial<ChatSession>) => {
    const sessions = authService.getChatSessions();
    const updated = sessions.map(s => s.id === sessionId ? { ...s, ...updates } : s);
    setLocal(CHAT_SESSIONS_KEY, updated);
  },

  getChatMessages: (): ChatMessage[] => getLocal(CHAT_MSG_STORAGE_KEY, []),

  addChatMessage: (message: ChatMessage) => {
    const messages = getLocal(CHAT_MSG_STORAGE_KEY, []);
    setLocal(CHAT_MSG_STORAGE_KEY, [...messages, message]);
  },

  getAssignmentMasters: (): AssignmentMaster[] => getLocal(ASSIGNMENT_MASTERS_KEY, []),

  createAssignmentMaster: (title: string, deadline: string): AssignmentMaster => {
    const masters = authService.getAssignmentMasters();
    const newMaster: AssignmentMaster = {
      id: Date.now().toString(),
      title,
      deadline,
      isActive: true,
      createdAt: new Date().toISOString()
    };
    setLocal(ASSIGNMENT_MASTERS_KEY, [newMaster, ...masters]);
    return newMaster;
  },

  // Submit an assignment for the current student
  onStudentSubmit: async (masterId: string, content: string) => {
    const currentUser = authService.getCurrentUser() as StudentData;
    if (!currentUser || currentUser.role !== UserRole.STUDENT) return;

    const masters = authService.getAssignmentMasters();
    const master = masters.find(m => m.id === masterId);
    if (!master) return;

    const newAssignment: Assignment = {
      id: Date.now().toString(),
      masterId: master.id,
      title: master.title,
      content,
      status: 'submitted',
      submittedAt: new Date().toISOString()
    };

    const updatedUser = {
      ...currentUser,
      assignments: [...(currentUser.assignments || []), newAssignment]
    };

    await authService.updateStudent(updatedUser);
  },

  // Grade a student's assignment
  onGrade: async (studentId: string, assignmentId: string, score: number) => {
    const students = authService.getStudents();
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const updatedAssignments = student.assignments.map(a => 
      a.id === assignmentId ? { ...a, score, status: 'graded' as const } : a
    );

    await authService.updateStudent({
      ...student,
      assignments: updatedAssignments
    });
  },

  // Add a teacher's reply to a student's assignment
  onTeacherReply: async (studentId: string, assignmentId: string, reply: string) => {
    const students = authService.getStudents();
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const updatedAssignments = student.assignments.map(a => 
      a.id === assignmentId ? { ...a, teacherReply: reply } : a
    );

    await authService.updateStudent({
      ...student,
      assignments: updatedAssignments
    });
  },

  getVotingSession: (): VotingSession => getLocal(VOTING_SESSION_KEY, { isActive: false, sessionId: 'init', lastStartedAt: '' }),

  updateVotingSession: (isActive: boolean) => {
    const current = authService.getVotingSession();
    const session: VotingSession = {
      isActive,
      sessionId: isActive && !current.isActive ? Date.now().toString() : current.sessionId,
      lastStartedAt: isActive && !current.isActive ? new Date().toISOString() : current.lastStartedAt
    };
    setLocal(VOTING_SESSION_KEY, session);
  },

  getVotes: (): Vote[] => getLocal(VOTES_KEY, []),

  castVote: (voterId: string, targetId: string) => {
    const session = authService.getVotingSession();
    if (!session.isActive) throw new Error('投票目前已關閉');
    const votes = authService.getVotes();
    const myVotes = votes.filter(v => v.voterId === voterId && v.sessionId === session.sessionId);
    if (myVotes.length >= 3) throw new Error('您在本輪投票中已經投完 3 票了');
    if (myVotes.some(v => v.targetId === targetId)) throw new Error('您已經投過這位同學了');

    const newVote: Vote = { voterId, targetId, sessionId: session.sessionId, timestamp: new Date().toISOString() };
    setLocal(VOTES_KEY, [...votes, newVote]);
  }
};
