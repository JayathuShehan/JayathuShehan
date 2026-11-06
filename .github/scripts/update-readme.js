// Refreshes the dynamic sections of README.md using live GitHub API data.
// Run by .github/workflows/update-readme.yml via actions/github-script.
const fs = require('fs');

const fmt = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

const replaceSection = (text, name, body) => {
  const re = new RegExp(`(<!-- ${name}:START -->)[\\s\\S]*?(<!-- ${name}:END -->)`);
  return text.replace(re, `$1\n${body}\n$2`);
};

module.exports = async ({ github, context }) => {
  const username = context.repo.owner;

  const { data: user } = await github.rest.users.getByUsername({ username });
  const repos = await github.paginate(github.rest.repos.listForUser, {
    username,
    type: 'owner',
    sort: 'pushed',
    per_page: 100,
  });

  // Own, non-archived repos, excluding this profile repo
  const own = repos.filter((r) => !r.fork && !r.archived && r.name !== username);
  own.sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));

  const stars = own.reduce((sum, r) => sum + r.stargazers_count, 0);
  const memberSince = new Date(user.created_at).toLocaleDateString('en-US', {
    month: 'short', year: 'numeric', timeZone: 'UTC',
  });
  const lastPush = repos.length
    ? fmt(repos.reduce((a, b) => (new Date(a.pushed_at) > new Date(b.pushed_at) ? a : b)).pushed_at)
    : '—';

  const statParts = [
    `📦 **${own.length}** public repos`,
    stars > 0 ? `⭐ **${stars}** stars` : null,
    `📅 on GitHub since **${memberSince}**`,
    `🕒 last push **${lastPush}**`,
  ].filter(Boolean);
  const stats = statParts.join(' &nbsp;·&nbsp; ');

  const rows = own.slice(0, 6).map((r) => {
    const desc = r.description ? ` — ${r.description.replace(/\|/g, '\\|')}` : '';
    const star = r.stargazers_count > 0 ? ` ⭐${r.stargazers_count}` : '';
    return `| [${r.name}](${r.html_url})${star}${desc} | ${r.language || '—'} | ${fmt(r.pushed_at)} |`;
  });
  const table = ['| Project | Language | Last update |', '|---|---|---|', ...rows].join('\n');

  let readme = fs.readFileSync('README.md', 'utf8');
  readme = replaceSection(readme, 'PROFILE_STATS', stats);
  readme = replaceSection(readme, 'RECENT_REPOS', table);
  fs.writeFileSync('README.md', readme);
};
