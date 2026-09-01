import { JobPosting } from '../types/job';

export class FloatingButton {
  private container: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private onTriggerScrape: () => Promise<JobPosting | null>;

  constructor(onTriggerScrape: () => Promise<JobPosting | null>) {
    this.onTriggerScrape = onTriggerScrape;
  }

  public mount() {
    if (document.getElementById('rezbuilder-floating-root')) return;

    this.container = document.createElement('div');
    this.container.id = 'rezbuilder-floating-root';
    this.container.style.position = 'fixed';
    this.container.style.bottom = '24px';
    this.container.style.right = '24px';
    this.container.style.zIndex = '2147483647'; // Maximum z-index
    this.container.style.fontFamily = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    this.shadow = this.container.attachShadow({ mode: 'open' });
    this.render();
    document.body.appendChild(this.container);
  }

  public unmount() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
      this.container = null;
      this.shadow = null;
    }
  }

  private render(status: 'idle' | 'loading' | 'success' | 'error' = 'idle', message: string = '') {
    if (!this.shadow) return;

    const styles = `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      .fab-container {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #0f172a;
        color: #f8fafc;
        border: 1px solid #334155;
        border-radius: 9999px;
        padding: 6px 14px 6px 8px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        user-select: none;
      }
      .fab-container:hover {
        background: #1e293b;
        border-color: #10b981;
        transform: translateY(-2px);
        box-shadow: 0 15px 30px -5px rgba(16, 185, 129, 0.25);
      }
      .fab-container:active {
        transform: translateY(0);
      }
      .badge-icon {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: linear-gradient(135deg, #059669, #10b981);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        font-weight: 700;
        font-size: 14px;
        flex-shrink: 0;
      }
      .fab-text {
        font-size: 13px;
        font-weight: 600;
        letter-spacing: -0.01em;
        display: flex;
        flex-direction: column;
      }
      .fab-subtitle {
        font-size: 10px;
        color: #94a3b8;
        font-weight: 400;
      }
      .spinner {
        width: 14px;
        height: 14px;
        border: 2px solid rgba(255,255,255,0.3);
        border-radius: 50%;
        border-top-color: #ffffff;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;

    let contentHtml = `
      <div class="badge-icon">⚡</div>
      <div class="fab-text">
        <span>RezBuilder</span>
        <span class="fab-subtitle">Analyze Job & Score</span>
      </div>
    `;

    if (status === 'loading') {
      contentHtml = `
        <div class="badge-icon"><div class="spinner"></div></div>
        <div class="fab-text">
          <span>Scraping Job...</span>
          <span class="fab-subtitle">Reading posting details</span>
        </div>
      `;
    } else if (status === 'success') {
      contentHtml = `
        <div class="badge-icon" style="background: #10b981;">✓</div>
        <div class="fab-text">
          <span>Job Captured!</span>
          <span class="fab-subtitle">${message || 'Opening Side Panel'}</span>
        </div>
      `;
    } else if (status === 'error') {
      contentHtml = `
        <div class="badge-icon" style="background: #ef4444;">!</div>
        <div class="fab-text">
          <span>Not Detected</span>
          <span class="fab-subtitle">Highlight text & right-click</span>
        </div>
      `;
    }

    this.shadow.innerHTML = `
      <style>${styles}</style>
      <div class="fab-container" id="rezbuilder-fab">
        ${contentHtml}
      </div>
    `;

    const fab = this.shadow.getElementById('rezbuilder-fab');
    if (fab && status === 'idle') {
      fab.addEventListener('click', async () => {
        this.render('loading');
        try {
          const job = await this.onTriggerScrape();
          if (job) {
            this.render('success', job.title.substring(0, 20) + '...');
            setTimeout(() => {
              this.render('idle');
            }, 3000);
          } else {
            this.render('error');
            setTimeout(() => {
              this.render('idle');
            }, 3000);
          }
        } catch (err) {
          console.error(err);
          this.render('error');
          setTimeout(() => {
            this.render('idle');
          }, 3000);
        }
      });
    }
  }
}
