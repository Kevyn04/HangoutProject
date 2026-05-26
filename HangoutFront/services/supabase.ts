import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://zkdrmmpjhdsoeshpcxqi.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprZHJtbXBqaGRzb2VzaHBjeHFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NTI2NzMsImV4cCI6MjA5NTMyODY3M30.eDOaewrrRxOhxw13yNW8mLcgdd_ZL5pAVYZxQx6ttsM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
