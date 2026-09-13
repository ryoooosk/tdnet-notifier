export interface Disclosure {
  readonly source: DisclosureSource;
  readonly originalId: string;
  readonly code: string; // 英数4文字
  readonly companyName: string;
  readonly title: string;
  readonly kind: DisclosureKind;
  readonly documentUrl: string;
  readonly disclosedAt: string; // UTC時刻
}

type DisclosureSource = 'tdnet' | 'edinet';

/**
 * 開示の種別。TDnet の一覧に種別カラムは無いため、表題の文字列から判定する。
 * 実データ 300 件の表題を分類。
 *
 * 並び順は株価インパクトの大きい順。1 つの開示が `〜及び〜` で複数の事象を
 * 兼ねることがあるため、判定は上から順に最初に一致したものを採る想定。
 */
type DisclosureKind =
  /** 業績予想の修正、業績予想と実績値との差異 */
  | 'guidanceRevision'
  /** 特別損失・減損損失の計上 */
  | 'specialLoss'
  /** 公開買付け（TOB / MBO）、意見表明、買付結果 */
  | 'tenderOffer'
  /** 合併、株式交換、株式移転、会社分割 */
  | 'merger'
  /** 子会社・関係会社の異動、設立、譲渡、組織再編 */
  | 'subsidiary'
  /** 業務提携、資本業務提携 */
  | 'alliance'
  /** 第三者割当、新株式発行、新株予約権付社債（希薄化を伴う資金調達） */
  | 'equityFinance'
  /** 上場廃止、監理銘柄・特設注意市場銘柄の指定 */
  | 'listingStatus'
  /** 剰余金の配当、配当予想の修正 */
  | 'dividend'
  /** 自己株式の取得・取得状況・ToSTNeT-3 による買付け */
  | 'buyback'
  /** 決算短信（四半期・通期） */
  | 'earnings'
  /** 決算説明資料、想定質問と回答、説明会資料。短信と同時に出る補足資料 */
  | 'earningsMaterial'
  /** 月次売上高、月次実績の開示 */
  | 'monthlyReport'
  /** 中期経営計画の策定・変更 */
  | 'midTermPlan'
  /** 資金の借入、社債発行など希薄化を伴わない資金調達 */
  | 'financing'
  /** 株主優待制度の新設・変更・廃止 */
  | 'shareholderBenefit'
  /** 新株予約権、ストック・オプション、譲渡制限付株式の発行 */
  | 'stockCompensation'
  /** 役員の異動、代表取締役の異動、人事 */
  | 'personnel'
  /** 株主総会の招集、定款の変更、コーポレート・ガバナンス報告書 */
  | 'governance'
  /** 上記のいずれにも当てはまらないもの。分類できないのは異常ではない */
  | 'other';
