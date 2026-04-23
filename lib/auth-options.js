import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';

const providers = [
  CredentialsProvider({
    name: 'Credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' }
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null;
      }

      return {
        id: credentials.email,
        name: credentials.email.split('@')[0],
        email: credentials.email,
        role: credentials.email === 'aknvpupuch@gmail.com' ? 'super_admin' : 'customer'
      };
    }
  })
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.unshift(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    })
  );
}

export const authOptions = {
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'dev-secret-change-me',
  session: {
    strategy: 'jwt'
  },
  pages: {
    signIn: '/auth/signin'
  },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user?.role) {
        token.role = user.role;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role || 'customer';
      }

      return session;
    }
  }
};
