import SwiftUI

struct LoginView: View {
    @StateObject private var viewModel = LoginViewModel()
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(hex: "#0F0F23"),
                    Color(hex: "#1F1F45"),
                    Color(hex: "#2D1B69")
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
            
            VStack(spacing: 30) {
                Spacer()
                
                VStack(spacing: 8) {
                    Image(systemName: "music.note")
                        .font(.system(size: 70))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [.pink, .purple, .blue],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .shadow(color: .purple.opacity(0.5), radius: 20)
                    
                    Text("Melodix")
                        .font(.system(size: 44, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                    
                    Text("Your Music. All Services. One App.")
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.7))
                }
                
                VStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(viewModel.title)
                            .font(.title2.bold())
                            .foregroundColor(.white)
                        Text(viewModel.subtitle)
                            .font(.subheadline)
                            .foregroundColor(.white.opacity(0.6))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    
                    if viewModel.mode == .signUp {
                        TextField("Display Name", text: $viewModel.displayName)
                            .textFieldStyle(CustomFieldStyle(icon: "person"))
                            .textContentType(.name)
                    }
                    
                    TextField("Email", text: $viewModel.email)
                        .textFieldStyle(CustomFieldStyle(icon: "envelope"))
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()
                    
                    ZStack(alignment: .trailing) {
                        HStack {
                            Image(systemName: "lock")
                                .foregroundColor(.white.opacity(0.5))
                            if viewModel.showPassword {
                                TextField("Password", text: $viewModel.password)
                                    .foregroundColor(.white)
                            } else {
                                SecureField("Password", text: $viewModel.password)
                                    .foregroundColor(.white)
                            }
                        }
                        .padding()
                        .background(.white.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                        
                        Button {
                            viewModel.showPassword.toggle()
                        } label: {
                            Image(systemName: viewModel.showPassword ? "eye.slash" : "eye")
                                .foregroundColor(.white.opacity(0.6))
                                .padding()
                        }
                    }
                    
                    if viewModel.mode == .signUp {
                        ZStack(alignment: .trailing) {
                            HStack {
                                Image(systemName: "lock.shield")
                                    .foregroundColor(.white.opacity(0.5))
                                if viewModel.showConfirmPassword {
                                    TextField("Confirm Password", text: $viewModel.confirmPassword)
                                        .foregroundColor(.white)
                                } else {
                                    SecureField("Confirm Password", text: $viewModel.confirmPassword)
                                        .foregroundColor(.white)
                                }
                            }
                            .padding()
                            .background(.white.opacity(0.1))
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                            
                            Button {
                                viewModel.showConfirmPassword.toggle()
                            } label: {
                                Image(systemName: viewModel.showConfirmPassword ? "eye.slash" : "eye")
                                    .foregroundColor(.white.opacity(0.6))
                                    .padding()
                            }
                        }
                        
                        if !viewModel.password.isEmpty {
                            HStack {
                                Text("Password strength:")
                                    .font(.caption)
                                    .foregroundColor(.white.opacity(0.6))
                                Text(viewModel.passwordStrengthLabel)
                                    .font(.caption.bold())
                                    .foregroundColor(viewModel.passwordStrengthColor)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    
                    if let error = viewModel.error {
                        Label(error.localizedDescription, systemImage: "exclamationmark.triangle")
                            .font(.footnote)
                            .foregroundColor(.red)
                            .padding(.top, 4)
                    }
                    
                    Button {
                        Task {
                            await viewModel.submit()
                        }
                    } label: {
                        HStack {
                            if viewModel.isLoading {
                                ProgressView()
                                    .tint(.white)
                            } else {
                                Text(viewModel.buttonTitle)
                                    .fontWeight(.bold)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(
                            LinearGradient(
                                colors: [.purple, .blue],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                        .foregroundColor(.white)
                    }
                    .disabled(!viewModel.isFormValid || viewModel.isLoading)
                    .opacity(viewModel.isFormValid ? 1 : 0.6)
                    
                    Button {
                        viewModel.toggleMode()
                    } label: {
                        Text(viewModel.mode == .signIn
                             ? "Don't have an account? **Create one**"
                             : "Already have an account? **Sign In**")
                            .font(.callout)
                            .foregroundColor(.white.opacity(0.8))
                    }
                    .padding(.top, 4)
                }
                .padding(24)
                .background(.white.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 24))
                .overlay(
                    RoundedRectangle(cornerRadius: 24)
                        .stroke(.white.opacity(0.15), lineWidth: 1)
                )
                .padding(.horizontal)
                
                Spacer()
            }
        }
    }
}

struct CustomFieldStyle: TextFieldStyle {
    let icon: String
    
    func _body(configuration: TextField<Self._Label>) -> some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(.white.opacity(0.5))
            configuration
                .foregroundColor(.white)
        }
        .padding()
        .background(.white.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

extension LoginViewModel {
    var passwordStrengthLabel: String {
        switch password.count {
        case 0...5: return "Weak"
        case 6...9: return "Fair"
        case 10...13: return "Good"
        default: return "Strong"
        }
    }
    
    var passwordStrengthColor: Color {
        switch passwordStrengthLabel {
        case "Weak": return .red
        case "Fair": return .orange
        case "Good": return .yellow
        default: return .green
        }
    }
}