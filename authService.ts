
import { createClient } from '@supabase/supabase-js';
import { User, StudentData, UserRole, QuizResult, ChatMessage, ChatSession, AssignmentMaster, VotingSession, Vote, Assignment } from '../types';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const authService = {
  isCloud: !!SUPABASE_URL && !!SUPABASE_ANON_KEY,

  init: async () => {},

  login: async (username: string, password: string): Promise<User | StudentData | null> => {
    const { data, error } = await supabase.from('users').select('*').eq('username', username).eq('password', password).single();
    if (error || !data) return null;
    const user = {
      ...data,
      quizResult: data.quiz_result,
      transactions: data.transactions || [],
      assignments: data.assignments || [],
      chatNicknames: data.chat_nicknames || {}
    };
    localStorage.setItem('class_sync_current_user', JSON.stringify(user));
    return user;
  },

  register: async (name: string, username: string, password: string, role: UserRole): Promise<User | StudentData> => {
    const id = Date.now().toString();
    const newUser = { id, name, username, password, role, balance: 0, transactions: [], assignments: [], chat_nicknames: {} };
    const { error } = await supabase.from('users').insert([newUser]);
    if (error) throw new Error('註冊失敗：' + error.message);
    const userToStore = { ...newUser, chatNicknames: {} };
    localStorage.setItem('class_sync_current_user', JSON.stringify(userToStore));
    return userToStore as any;
  },

  logout: () => localStorage.removeItem('class_sync_current_user'),

  getCurrentUser: (): User | null => {
    const s = localStorage.getItem('class_sync_current_user');
    return s ? JSON.parse(s) : null;
  },

  getStudents: async (): Promise<StudentData[]> => {
    const { data } = await supabase.from('users').select('*').eq('role', UserRole.STUDENT);
    return (data || []).map(d => ({ ...d, quizResult: d.quiz_result, chatNicknames: d.chat_nicknames || {} }));
  },

  updateStudent: async (studentData: StudentData) => {
    await supabase.from('users').update({ balance: studentData.balance, transactions: studentData.transactions, quiz_result: studentData.quizResult, assignments: studentData.assignments, chat_nicknames: studentData.chatNicknames }).eq('id', studentData.id);
  },

  getChatSessions: async (): Promise<ChatSession[]> => {
    const { data } = await supabase.from('chat_sessions').select('*').order('created_at', { ascending: false });
    return (data || []).map(d => ({ id: d.id, topic: d.topic, isActive: d.is_active, createdAt: d.created_at }));
  },

  createChatSession: async (topic: string): Promise<ChatSession> => {
    const newSession = { id: Date.now().toString(), topic, is_active: true };
    await supabase.from('chat_sessions').insert([newSession]);
    return { id: newSession.id, topic: newSession.topic, isActive: true, createdAt: new Date().toISOString() };
  },

  // Added updateChatSession to fix App.tsx error
  updateChatSession: async (sessionId: string, updates: Partial<ChatSession>) => {
    const supabaseUpdates: any = {};
    if (updates.topic !== undefined) supabaseUpdates.topic = updates.topic;
    if (updates.isActive !== undefined) supabaseUpdates.is_active = updates.isActive;
    await supabase.from('chat_sessions').update(supabaseUpdates).eq('id', sessionId);
  },

  getChatMessages: async (sessionId?: string): Promise<ChatMessage[]> => {
    let query = supabase.from('chat_messages').select('*');
    if (sessionId) query = query.eq('session_id', sessionId);
    const { data } = await query.order('timestamp', { ascending: true });
    return (data || []).map(m => ({ id: m.id, sessionId: m.session_id, userId: m.user_id, userName: m.user_name, content: m.content, timestamp: m.timestamp, isAnonymous: m.is_anonymous }));
  },

  addChatMessage: async (m: ChatMessage) => {
    await supabase.from('chat_messages').insert([{ id: m.id, session_id: m.sessionId, user_id: m.userId, user_name: m.userName, content: m.content, timestamp: m.timestamp, is_anonymous: m.isAnonymous }]);
  },

  saveStudentNickname: async (userId: string, sessionId: string, nickname: string) => {
    const { data } = await supabase.from('users').select('chat_nicknames').eq('id', userId).single();
    const nicknames = data?.chat_nicknames || {};
    nicknames[sessionId] = nickname;
    await supabase.from('users').update({ chat_nicknames: nicknames }).eq('id', userId);
  },

  submitQuizResult: async (studentId: string, result: QuizResult) => {
    await supabase.from('users').update({ quiz_result: result }).eq('id', studentId);
  },

  getAssignmentMasters: async (): Promise<AssignmentMaster[]> => {
    const { data } = await supabase.from('assignment_masters').select('*').order('created_at', { ascending: false });
    return (data || []).map(m => ({ id: m.id, title: m.title, deadline: m.deadline, createdAt: m.created_at, isActive: m.is_active }));
  },

  createAssignmentMaster: async (title: string, deadline: string) => {
    await supabase.from('assignment_masters').insert([{ id: Date.now().toString(), title, deadline, is_active: true }]);
  },

  onStudentSubmit: async (masterId: string, content: string) => {
    const user = authService.getCurrentUser() as StudentData;
    if (!user) return;
    const { data } = await supabase.from('users').select('assignments').eq('id', user.id).single();
    const current = data?.assignments || [];
    const newItem: Assignment = { id: Date.now().toString(), masterId, title: '作業繳交', content, status: 'submitted', submittedAt: new Date().toISOString() };
    await supabase.from('users').update({ assignments: [...current, newItem] }).eq('id', user.id);
  },

  onGrade: async (studentId: string, aid: string, score: number) => {
    const { data } = await supabase.from('users').select('assignments').eq('id', studentId).single();
    const list = (data?.assignments || []).map((a: any) => a.id === aid ? { ...a, score, status: 'graded' } : a);
    await supabase.from('users').update({ assignments: list }).eq('id', studentId);
  },

  onTeacherReply: async (studentId: string, aid: string, reply: string) => {
    const { data } = await supabase.from('users').select('assignments').eq('id', studentId).single();
    const list = (data?.assignments || []).map((a: any) => a.id === aid ? { ...a, teacherReply: reply } : a);
    await supabase.from('users').update({ assignments: list }).eq('id', studentId);
  },

  // Added voting methods to fix VotingView.tsx errors
  getVotingSession: async (): Promise<VotingSession> => {
    const { data } = await supabase.from('voting_session').select('*').single();
    if (!data) return { isActive: false, sessionId: '1', lastStartedAt: new Date().toISOString() };
    return {
      isActive: data.is_active,
      sessionId: data.session_id,
      lastStartedAt: data.last_started_at
    };
  },

  getVotes: async (): Promise<Vote[]> => {
    const { data } = await supabase.from('votes').select('*');
    return (data || []).map(v => ({
      voterId: v.voter_id,
      targetId: v.target_id,
      sessionId: v.session_id,
      timestamp: v.timestamp
    }));
  },

  updateVotingSession: async (isActive: boolean) => {
    const { data: current } = await supabase.from('voting_session').select('*').single();
    const newSessionId = isActive && !current?.is_active ? Date.now().toString() : (current?.session_id || '1');
    
    if (current) {
      await supabase.from('voting_session').update({ 
        is_active: isActive, 
        session_id: newSessionId, 
        last_started_at: isActive ? new Date().toISOString() : current.last_started_at 
      }).eq('id', current.id);
    } else {
      await supabase.from('voting_session').insert([{ 
        is_active: isActive, 
        session_id: newSessionId, 
        last_started_at: new Date().toISOString() 
      }]);
    }
  },

  castVote: async (voterId: string, targetId: string) => {
    const { data: sessionData } = await supabase.from('voting_session').select('*').single();
    if (!sessionData || !sessionData.is_active) throw new Error("目前非投票時間");
    
    const { data: allSessionVotes } = await supabase.from('votes')
      .select('*')
      .eq('voter_id', voterId)
      .eq('session_id', sessionData.session_id);
      
    if (allSessionVotes && allSessionVotes.length >= 3) throw new Error("本輪 3 票已全數投出");
    if (allSessionVotes && allSessionVotes.some(v => v.target_id === targetId)) throw new Error("此輪已投過該同學");

    await supabase.from('votes').insert([{
      voter_id: voterId,
      target_id: targetId,
      session_id: sessionData.session_id,
      timestamp: new Date().toISOString()
    }]);
  }
};
