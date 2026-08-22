import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CopyText } from "../components/CopyText";
import { Page } from "../components/Page";
import { PlaylistEmbed, type PlaylistItem } from "../components/PlaylistEmbed";

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline decoration-[#20211f]/20 underline-offset-4 transition hover:decoration-[#20211f]/70"
    >
      {children}
      <span aria-hidden="true" className="ml-1 text-xs text-[#20211f]/40">
        ↗
      </span>
    </a>
  );
}

const playlistGroups: { label: string; items: PlaylistItem[] }[] = [
  {
    label: "2019-2026",
    items: [
      { title: "2026 интуиция", href: "https://music.apple.com/cn/playlist/2026-%D0%B8%D0%BD%D1%82%D1%83%D0%B8%D1%86%D0%B8%D1%8F/pl.u-gxblgG7t5vZ91kN", platform: "Apple Music" },
      { title: "2026 задумываться", href: "https://music.apple.com/cn/playlist/2026-%D0%B7%D0%B0%D0%B4%D1%83%D0%BC%D1%8B%D0%B2%D0%B0%D1%82%D1%8C%D1%81%D1%8F/pl.u-GgA5ka5sZep4gjJ", platform: "Apple Music" },
      { title: "2024-2025 Annihilation or Petrification?", href: "https://music.apple.com/cn/playlist/2024-2025-annihilation-or-petrification/pl.u-WabZvAVudmYa7xB", platform: "Apple Music" },
      { title: "2023 Spanning", href: "https://music.apple.com/cn/playlist/2023-spanning/pl.u-NpXmza7tmB7oqk2", platform: "Apple Music" },
      { title: "2022 monument", href: "https://music.apple.com/cn/playlist/2022-monument/pl.u-WabZv4ZidmYa7xB", platform: "Apple Music" },
      { title: "2021 inner film", href: "https://music.apple.com/cn/playlist/2021-inner-film/pl.u-NpXmzeWFmB7oqk2", platform: "Apple Music" },
      { title: "2019-2020 watch the matter", href: "https://music.apple.com/cn/playlist/2019-2020-watch-the-matter/pl.u-jV890vLud63xKMr", platform: "Apple Music" },
    ],
  },
  {
    label: "2019 之前",
    items: [
      { title: "ρ", href: "https://music.163.com/#/playlist?id=8387263303", platform: "网易云音乐" },
      { title: "ξ", href: "https://music.163.com/#/playlist?id=6613502033", platform: "网易云音乐" },
      { title: "γ", href: "https://music.163.com/#/playlist?id=5168675317", platform: "网易云音乐" },
      { title: "Ω", href: "https://music.163.com/#/playlist?id=5169873370", platform: "网易云音乐" },
    ],
  },
] as const;

export function JewelRoamPage() {
  return (
    <Page
      title="JewelRoam"
      intro={
        <div className="space-y-3">
          <p>欢迎来看我，这个 ID 来自于我中文名的音译，网站图标是名字的第三字，来自欧阳询《九成宫醴泉碑》。</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm leading-6">
            <span>
              <span className="text-[#20211f]/50">WeChat</span> ·{" "}
              <CopyText value="Zheng_Enrong" label="WeChat ID" />
            </span>
            <span>
              <span className="text-[#20211f]/50">GitHub</span> ·{" "}
              <ExternalLink href="https://github.com/JewelRoam">
                JewelRoam
              </ExternalLink>
            </span>
            <span>
              <span className="text-[#20211f]/50">Instagram</span> ·{" "}
              <ExternalLink href="https://www.instagram.com/jewelroam">
                @jewelroam
              </ExternalLink>
            </span>
            <span>
              <span className="text-[#20211f]/50">rednote</span> · ID:{" "}
              <CopyText value="308651036" label="rednote ID" />
            </span>
          </div>
        </div>
      }
    >
      <div className="space-y-6 text-lg leading-9 text-[#20211f]/75">
        <section className="border-t border-[#20211f]/10 pt-8">
          <h2 className="font-serif text-2xl text-[#20211f]">History</h2>
          <div className="mt-6 space-y-8 text-base leading-7">
            <p className="text-[#20211f]/60">
              还记得初中班主任说，期待你们以后回看，“人间曙，疏林平楚，历历来时路。”
              <br />
              很喜欢 OnePlus 之前的广告词，“Never Settle”，
              <br />
              即便现在还无法做到，但总期待摆脱路径依赖，体验一百种人生。
            </p>
            <div>
              <h3 className="text-xs uppercase tracking-[0.16em] text-[#20211f]/50">
                2004
              </h3>
              <p className="mt-3">
                自打出生开始，我便在潮汕的海风中长大。
                <br />
                孩提时代腼腆内敛，一直好奇着远方，潮水往复，街巷热闹，思绪繁多却习惯旁观。
              </p>
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-[0.16em] text-[#20211f]/50">
                2022
              </h3>
              <p className="mt-3">
                怀着憧憬奔赴北京，踏入BUPT，开始学习通信。
                <br />
                后来，有幸入选了叶培大创新创业实验班。
              </p>
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-[0.16em] text-[#20211f]/50">
                2023-2024
              </h3>
              <p className="mt-3">
                进入北邮模式识别与智能系统（PRIS）实验室，开始学习一些领域数据集，视觉模型，乃至前端开发的知识，遇到了高瞻远瞩的导师、耐心有爱的学长和优秀的小伙伴。
              </p>
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-[0.16em] text-[#20211f]/50">
                2023-2024
              </h3>
              <p className="mt-3">
                在 OpenHarmony 开源鸿蒙技术俱乐部当负责人，学习了一些硬件知识。
              </p>
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-[0.16em] text-[#20211f]/50">
                2023-2024
              </h3>
              <p className="mt-3">
                组建了北邮赛车俱乐部 &amp; UU Racing 车队
                <br />
                多亏队友一拍即合，在 TopRace、MOZA RACING、PXN
                等主流模拟器联赛中屡获佳绩；参加体育局主办的第一、二届北京大学生卡丁车精英赛，北京体育总汇、北京市卡丁车运动协会、北京日报、网易新闻等媒体报道；参加
                2025 雅森改装车展、北京金盏速度节……
              </p>
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-[0.16em] text-[#20211f]/50">
                2024
              </h3>
              <p className="mt-3">
                那年暑假，我去伦敦的 QMUL 交换，体验了两个月留子。
              </p>
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-[0.16em] text-[#20211f]/50">
                2023-2025
              </h3>
              <p className="mt-3">
                在北邮摄影社担任社长，这里有我大学期间最珍贵的一群好友。
                <br />
                我组织过数十（或许上百）次团建和采风，和小伙伴们自驾去了海南、潮汕、闽南、山西、内蒙、东北、新疆、日本等地方；与北京高校社团及适马中国、影石、富士、索尼、尼康等品牌合作举办工作坊、赛事与联合活动，受邀参与了几场摄影展、艺术展、创意营和媒体酒会等。
                <br />
                我还在学校里搭了一座用于胶片冲洗、照片放大的暗房。
              </p>
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-[0.16em] text-[#20211f]/50">
                2024-2025
              </h3>
              <p className="mt-3">
                机缘巧合使然，进入到电信北京研究院做训推一体化设施、LLM
                推理基建，与 Intel、NVIDIA、Ascend、壁仞、天数等合作，参与
                vLLM、SGlang、Dynamo 和一些算子库的调优。在这里，我第一位 mentor
                带我了解到企业级的部署方案，在软硬件异构任务中初步积累了工程经验。
              </p>
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-[0.16em] text-[#20211f]/50">
                2024-2025
              </h3>
              <p className="mt-3">
                瞄准应急管理、智慧农业、交通运输等场景，做了一个遥感解译、地信数据要素相关的项目，
                取得软著 6 项、专利 4 项，与国家减灾中心达成两期合作总金额两百万余元；
                <br />
                “互联网+”国创赛全国铜奖、北京赛区一等奖；第十届通信与信息处理国际会议金奖；
                计算机设计大赛一等奖；“挑战杯”特等奖；全国大创成果展“最佳人气奖”、百强创业团队……
              </p>
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-[0.16em] text-[#20211f]/50">
                2024-2025
              </h3>
              <p className="mt-3">
                出于对家乡文化和本土新生创造力的热情，参与了：
                <br />
                在驻京办举办的
                潮籍青年学子潮峰思享汇，包括沙龙、圆桌对话、开放交互等；
                <br />
                在潮汕的 观潮 KwanTeo 电影节，关注文化叙事、在地化艺术创作。
                <br />
                <br />
                主创、策划了粤东首个 Hackathon{" "}
                <ExternalLink href="https://23-5-n-geekday.github.io/">
                  北回归线极客节
                </ExternalLink>
                ，这里有：
                <br />
                AI Agent 智能体、Embodied AI
                具身智能共两赛道、三组别、150+选手参赛；
                <br />
                智源、百度、阿里云、字节、算能、地瓜、非夕、拓竹、矽递、老鹰基金、潮创会……
                <br />
                相关报道：
                <span className="ml-1 inline-flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <ExternalLink href="https://strbmob.strtv.cn/qnbmob/content/202604/07/c191905.html">
                    特区青年报
                  </ExternalLink>
                  <ExternalLink href="https://t.cj.sina.com.cn/articles/view/2833534593/a8e44e8102001acsq">
                    新浪财经
                  </ExternalLink>
                  <ExternalLink href="https://hosting.wavpub.cn/ccccchenxiaoyao/2026/01/18/13-%e4%b8%93%e6%b3%a8ai%e7%9a%84%e6%bd%ae%e6%b1%95%e9%9d%92%e5%b9%b4%ef%bc%8c%e6%83%b3%e6%8a%8a%e6%9e%81%e5%ae%A2%e7%b2%be%e7%a5%9e%e5%b8%a6%e5%9b%9e%e6%95%85%e4%b9%a1%ef%bd%9c%e5%af%b9%e8%af%9d/">
                    岂北
                  </ExternalLink>
                  <ExternalLink href="https://www.gd.chinanews.com.cn/2026/2026-02-27/446656.shtml">
                    中国新闻网
                  </ExternalLink>
                  <ExternalLink href="https://www.pingwest.com/a/310818">
                    品玩
                  </ExternalLink>
                  <ExternalLink href="https://www.v2ex.com/t/1192703">
                    V2EX
                  </ExternalLink>
                  <ExternalLink href="https://wxredian.com/art?id=4e3ca017deebf355330cd5c9f3cb12f8">
                    观潮
                  </ExternalLink>
                  <ExternalLink href="https://www.xiaoyuzhoufm.com/episode/696bb917df9e07cdc45ec65d">
                    小宇宙
                  </ExternalLink>
                  <ExternalLink href="https://www.163.com/dy/article/KG8I6A4T0511N33R.html">
                    硅星人网易
                  </ExternalLink>
                </span>
                <br />
                不过个人最大的收获可能是认识了可以在北京每周约饭、一起做饭的老乡～
              </p>
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-[0.16em] text-[#20211f]/50">
                2025-至今
              </h3>
              <p className="mt-3">
                我来到百度基模团队（之前的飞桨 Paddle），
                <br />
                前期做了一些 AI for System 的创新项目
                <span className="ml-1 inline-flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <ExternalLink href="https://github.com/PaddlePaddle/GraphNet">
                    GraphNet
                  </ExternalLink>
                  <ExternalLink href="https://github.com/PaddlePaddle/PassNet">
                    PassNet
                  </ExternalLink>
                </span>
                ，
                <br />
                后期在做 RL Infra 的迭代升级，尚未开源。
                <br />
                在百度，几位恩师手把手教给了我许多价值判断、代码规范和交付的实操细节。
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-[#20211f]/10 pt-8">
          <h2 className="font-serif text-2xl text-[#20211f]">Publications</h2>
          <div className="mt-6 text-base leading-7">
            <ExternalLink href="https://orcid.org/0009-0009-8600-7695">
              ORCID
            </ExternalLink>
          </div>
        </section>

        <section className="border-t border-[#20211f]/10 pt-8">
          <h2 className="font-serif text-2xl text-[#20211f]">Playlists</h2>
          <div className="mt-6 space-y-8 text-base leading-7">
            <p className="text-[#20211f]/60">一些陪我走过不同年份的声音。</p>
            {playlistGroups.map((group) => (
              <div key={group.label}>
                <h3 className="text-xs uppercase tracking-[0.16em] text-[#20211f]/50">
                  {group.label}
                </h3>
                <ul className="playlist-grid mt-3">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <PlaylistEmbed item={item} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-[#20211f]/10 pt-8">
          <h2 className="font-serif text-2xl text-[#20211f]">Rights</h2>
          <div className="mt-6 text-base leading-7">
            <Link
              to="/rights"
              className="underline decoration-[#20211f]/20 underline-offset-4 transition hover:decoration-[#20211f]/70"
            >
              Rights <span aria-hidden="true" className="ml-1 text-xs text-[#20211f]/40">↗</span>
            </Link>
          </div>
        </section>
      </div>
    </Page>
  );
}
