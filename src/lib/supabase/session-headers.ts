// Superset dos campos que NavBar, NotificationCenter e requireProfile() precisam
// do perfil. Buscado uma única vez no middleware (updateSession, em
// ./middleware.ts) e repassado pra esses Server Components via header — evita
// repetir getUser() + query de perfil em cada um a toda navegação.
export const PROFILE_COLUMNS =
  "id, full_name, birthdate, phone, avatar_url, nickname_badge, is_setter, attendance_frequency, has_vpa_shirt, wants_tournaments, player_level, is_organizer, status, guest_for_event_id";
export const USER_ID_HEADER = "x-user-id";
export const PROFILE_HEADER = "x-profile";
