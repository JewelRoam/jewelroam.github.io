import { Page } from "../components/Page";

export function RightsPage() {
  return (
    <Page
      title="Rights"
      intro="关于站内图片、文字内容的使用与许可。"
    >
      <div className="border-t border-[#20211f]/10 pt-8 text-base leading-8 text-[#20211f]/75">
        <p>
          除非页面另有说明，站内图片、文字内容不得复制、改编、转载或用于商业用途。
          如需转载、出版、展览或商业授权，请通过项目维护者提供的联系方式说明使用范围、媒介和期限。
        </p>
      </div>
    </Page>
  );
}
