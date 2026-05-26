import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://wnmatztyaowvudlellha.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndubWF0enR5YW93dnVkbGVsbGhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MDg5MDcsImV4cCI6MjA5NDk4NDkwN30.l6jV2IMlYg08oz90TtaX5U-Vuineov84hNPTGut3Kns";

const CLUB_ID = parseInt(import.meta.env.VITE_CLUB_ID) || 1;

// Kiểm tra xem đã điền đầy đủ và đúng thông tin cấu hình chưa
const isConfigured = 
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== "https://your-project-id.supabase.co" && 
  !supabaseUrl.includes("your-project-id") && 
  !supabaseAnonKey.includes("your-anon-key");

export const supabase = isConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Ghi nhật ký trạng thái cấu hình
if (!isConfigured) {
  console.warn(
    "Supabase chưa được cấu hình đầy đủ trong tệp .env. Ứng dụng sẽ tự động chạy ở chế độ Offline (LocalStorage)."
  );
}

/**
 * Lấy dữ liệu từ bảng pickleball_club trên Supabase
 * @returns {Promise<{data: any, updated_at: string} | null>}
 */
export async function fetchRemoteData() {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("pickleball_club")
      .select("data, updated_at")
      .eq("id", CLUB_ID)
      .single();

    if (error) {
      // Nếu lỗi do bảng chưa có dòng nào, hoặc lỗi khác
      console.error("Lỗi khi tải dữ liệu từ Supabase:", error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error("Lỗi kết nối khi tải dữ liệu Supabase:", err);
    return null;
  }
}

/**
 * Lấy chỉ mốc thời gian cập nhật của dữ liệu trên Supabase
 * @returns {Promise<string | null>}
 */
export async function fetchRemoteTimestamp() {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("pickleball_club")
      .select("updated_at")
      .eq("id", CLUB_ID)
      .single();

    if (error) {
      console.error("Lỗi khi tải timestamp từ Supabase:", error.message);
      return null;
    }
    return data ? data.updated_at : null;
  } catch (err) {
    console.error("Lỗi kết nối khi tải timestamp Supabase:", err);
    return null;
  }
}

/**
 * Cập nhật dữ liệu lên bảng pickleball_club trên Supabase
 * @param {object} clubData - Toàn bộ dữ liệu { members, events, matches }
 * @param {string} [customTimestamp] - Mốc thời gian cập nhật tùy chọn để đồng bộ thời gian thực nhất quán
 * @returns {Promise<boolean>} - Trạng thái thành công hay thất bại
 */
export async function updateRemoteData(clubData, customTimestamp = null) {
  if (!supabase) return false;
  try {
    const timestamp = customTimestamp || new Date().toISOString();
    const { error } = await supabase
      .from("pickleball_club")
      .upsert({
        id: CLUB_ID,
        data: clubData,
        updated_at: timestamp
      });

    if (error) {
      console.error("Lỗi khi lưu dữ liệu lên Supabase:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Lỗi kết nối khi lưu dữ liệu Supabase:", err);
    return false;
  }
}
