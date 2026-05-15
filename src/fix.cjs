const fs = require('fs');
let code = fs.readFileSync('App.jsx', 'utf8');
const broken = `const [isRegistering, setIsRegistering] = useState(false);
    const { data: user } = await supabase.from("users").select("*").eq("username", username).eq("password", password).maybeSingle()
    if (user) { setError(""); onLogin(user); }
    else setError("✗ Invalid username or password!");
  };`;
const fixed = `const [isRegistering, setIsRegistering] = useState(false);

  const handleLogin = async () => {
    const { data: user } = await supabase.from("users").select("*").eq("username", username).eq("password", password).maybeSingle();
    if (user) { setError(""); onLogin(user); }
    else setError("✗ Invalid username or password!");
  };`;
code = code.replace(broken, fixed);
fs.writeFileSync('App.jsx', code);
console.log('Done! Replaced:', code.includes('const handleLogin'));
