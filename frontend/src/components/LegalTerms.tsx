/**
 * 服务协议与隐私政策（完整版，六个条款）
 * - 「更多」页：关于作者下方折叠展开
 * - 登录/注册页：底部完整展示
 * 文案与 Login 页历史版本保持一致。
 */
export function LegalTermsContent() {
  return (
    <div className="space-y-2 text-[11px] leading-relaxed text-muted-foreground/80">
      <div>
        <h4 className="mb-0.5 text-xs font-medium text-foreground/80">一、平台性质</h4>
        <p>本站为本班同学免费内部学习平台，非营利性质，不对外公开推广。</p>
      </div>
      <div>
        <h4 className="mb-0.5 text-xs font-medium text-foreground/80">二、内容规范</h4>
        <p>用户评论、上传图片仅限学习交流。禁止发布盗版资源、不良图文、他人隐私信息及广告引流内容；禁止向外分享访问链接、邀请非本班人员访问。</p>
      </div>
      <div>
        <h4 className="mb-0.5 text-xs font-medium text-foreground/80">三、法律责任</h4>
        <p>用户在平台上发布的图文内容由发布者自行承担法律责任。违规内容一经发现将立即删除，发布者账号将被限制访问。</p>
      </div>
      <div>
        <h4 className="mb-0.5 text-xs font-medium text-foreground/80">四、知识产权</h4>
        <p>本站收录的词汇、音频等学习资源仅供内部教学使用。如有版权争议，请通过「更多」页面底部联系站长，我们将及时处理。</p>
      </div>
      <div>
        <h4 className="mb-0.5 text-xs font-medium text-foreground/80">五、隐私保护</h4>
        <p>本站仅收集用户名与加密密码用于账号登录，学习记录（已学单词、笔记、收藏等）存储于服务器以便跨设备同步。我们不会向任何第三方提供您的个人数据。</p>
      </div>
      <div>
        <h4 className="mb-0.5 text-xs font-medium text-foreground/80">六、生效条款</h4>
        <p>访问或注册本站即视为您已阅读、理解并同意以上全部约定。本协议可能根据实际情况更新，更新后继续使用即视为接受新条款。</p>
      </div>
    </div>
  )
}
