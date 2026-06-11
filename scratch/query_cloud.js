import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-client';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://omfhyyaxvghbzhxzhvyc.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.log("No Supabase key found in process env.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('pickleball_club')
    .select('data')
    .eq('id', '1')
    .single();

  if (error) {
    console.error(error);
    return;
  }

  const matches = data.data.matches || [];
  const members = data.data.members || [];
  
  console.log("Total matches:", matches.length);
  console.log("Total members:", members.length);

  const son = members.find(m => m.name.includes("Sơn"));
  const hao = members.find(m => m.name.includes("Hào"));

  if (!son || !hao) {
    console.log("Could not find Son or Hao by name.");
    console.log("Son:", son);
    console.log("Hao:", hao);
    return;
  }

  console.log(`Sơn ID: ${son.id}, Hào ID: ${hao.id}`);

  const mutualMatches = matches.filter(match => {
    const teamA = match.teamA || [];
    const teamB = match.teamB || [];
    const hasSon = teamA.includes(son.id) || teamB.includes(son.id);
    const hasHao = teamA.includes(hao.id) || teamB.includes(hao.id);
    return hasSon && hasHao;
  });

  console.log(`Matches involving both (${mutualMatches.length}):`);
  mutualMatches.forEach(m => {
    console.log(`- Date: ${m.date}, Type: ${m.type}, TeamA: ${m.teamA.map(id => members.find(x => x.id === id)?.name).join('/')}, TeamB: ${m.teamB.map(id => members.find(x => x.id === id)?.name).join('/')}, Score: ${m.scoreA}-${m.scoreB}`);
  });
}

run();
