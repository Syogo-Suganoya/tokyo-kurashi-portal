from diagrams import Cluster, Diagram, Edge
from diagrams.generic.storage import Storage
from diagrams.onprem.client import Users
from diagrams.onprem.network import Internet
from diagrams.programming.framework import Nextjs
from diagrams.programming.language import Typescript
from diagrams.saas.cdn import Cloudflare

FONT = "Hiragino Sans"

# 標識の藍。アプリの主色（globals.css の --accent）に合わせる
ACCENT = "#17408b"

graph_attr = {
    "fontname": FONT,
    "fontsize": "20",
    "labelloc": "t",
    "bgcolor": "white",
    "pad": "0.5",
    "nodesep": "0.8",
    "ranksep": "1.5",
    "splines": "spline",
}
node_attr = {"fontname": FONT, "fontsize": "13"}
edge_attr = {"fontname": FONT, "fontsize": "11"}
cluster_attr = {"fontname": FONT, "fontsize": "13", "style": "rounded", "penwidth": "1.6"}

with Diagram(
    "くらしの道しるべ — 技術スタック",
    filename="docs/architecture",
    outformat="png",
    show=False,
    direction="LR",
    graph_attr=graph_attr,
    node_attr=node_attr,
    edge_attr=edge_attr,
):
    user = Users("ブラウザ")

    with Cluster("ビルド時（手元）", graph_attr=cluster_attr):
        ingest = Typescript("取り込み\nスクリプト")
        generated = Storage("静的JSON\n（リポジトリに同梱）")

    with Cluster("オープンデータ", graph_attr=cluster_attr):
        tokyo = Internet("東京都\nオープンデータカタログ")
        keishicho = Internet("警視庁\n認知件数CSV")

    with Cluster("Cloudflare Workers", graph_attr=cluster_attr):
        app = Nextjs("Next.js 16\n(OpenNext)")
        ai = Cloudflare("Workers AI\n分野判定のみ")

    gsi = Internet("国土地理院\n地図タイル")

    # --- ビルド時。点線で「当日は通らない経路」であることを示す ---
    tokyo >> Edge(style="dashed", label="ビルド時のみ") >> ingest
    keishicho >> Edge(style="dashed") >> ingest
    ingest >> Edge(style="dashed", label="検証して出力") >> generated
    generated >> Edge(style="dashed", label="同梱") >> app

    # --- 実行時。ここに行政のサーバへ出ていく線は無い ---
    user >> Edge(color=ACCENT, penwidth="2.0") >> app
    app >> Edge(color=ACCENT, label="バインディング\n（APIキー無し）") >> ai
    user >> Edge(color=ACCENT, style="dotted", label="タイルのみ") >> gsi
