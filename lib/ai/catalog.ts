/** 쇼핑 AI가 추천에 사용하는 일반(비광고) 상품 카탈로그 - 시연용 가상 상품 */
export interface CatalogProduct {
  productId: string;
  name: string;
  brand: string;
  price: number;
  category: string;
  keywords: string[];
  description: string;
}

export const CATALOG: CatalogProduct[] = [
  {
    productId: "P-101",
    name: "온유 슬림 텀블러",
    brand: "온유",
    price: 28000,
    category: "텀블러",
    keywords: ["텀블러", "출근", "슬림", "가벼운"],
    description: "350mL · 가방에 쏙 들어가는 슬림형, 6시간 보온",
  },
  {
    productId: "P-102",
    name: "브루웨이 머그 텀블러",
    brand: "브루웨이",
    price: 19000,
    category: "텀블러",
    keywords: ["텀블러", "머그", "손잡이", "사무실"],
    description: "500mL · 손잡이가 있는 사무실용 머그형",
  },
  {
    productId: "P-103",
    name: "써모킹 진공 텀블러",
    brand: "써모킹",
    price: 35000,
    category: "텀블러",
    keywords: ["텀블러", "보온", "보냉", "대용량"],
    description: "600mL · 12시간 보온, 대용량 캠핑용",
  },
  {
    productId: "P-201",
    name: "페더스텝 러너",
    brand: "노바핏",
    price: 89000,
    category: "러닝화",
    keywords: ["러닝화", "운동화", "가벼운", "조깅", "입문"],
    description: "무게 210g의 경량 데일리 러닝화",
  },
  {
    productId: "P-202",
    name: "쿠셔닝 맥스 3",
    brand: "트레일하우스",
    price: 149000,
    category: "러닝화",
    keywords: ["러닝화", "운동화", "쿠션", "장거리", "마라톤"],
    description: "두꺼운 폼 미드솔의 장거리 쿠션화",
  },
  {
    productId: "P-301",
    name: "사일런스 버즈 프로",
    brand: "에코웨이브",
    price: 179000,
    category: "무선 이어폰",
    keywords: ["이어폰", "무선", "노이즈캔슬링", "출퇴근"],
    description: "하이브리드 노이즈 캔슬링, 최대 30시간 재생",
  },
  {
    productId: "P-302",
    name: "스포츠 핏 이어버드",
    brand: "런비트",
    price: 69000,
    category: "무선 이어폰",
    keywords: ["이어폰", "무선", "운동", "방수"],
    description: "IPX7 방수, 운동 중 빠지지 않는 이어훅",
  },
  {
    productId: "P-401",
    name: "커뮤터 백팩 20L",
    brand: "어반캐리",
    price: 79000,
    category: "백팩",
    keywords: ["백팩", "가방", "출근", "노트북가방"],
    description: "15인치 노트북 수납, 생활 방수 원단",
  },
];

/** "3만 원 이하", "20000원 이내" 같은 예산 조건을 원 단위로 읽는다 (없으면 null) */
export function parseBudget(query: string): number | null {
  const q = query.replace(/,/g, "");
  const man = q.match(/(\d+(?:\.\d+)?)\s*만\s*원?\s*(이하|이내|미만|까지|아래|안)/);
  if (man) return Math.round(Number(man[1]) * 10000);
  const won = q.match(/(\d{4,})\s*원\s*(이하|이내|미만|까지|아래|안)/);
  if (won) return Number(won[1]);
  return null;
}
