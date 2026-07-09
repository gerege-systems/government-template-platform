// Gerege Template Version 27.0
// Gerege Systems Development Team болон Claude AI хамтран бүтээв, 2026.

import SwiftUI

// Нэвтрэх эхлэл — eID эсвэл Gerege SSO сонголт.
struct LoginView: View {
    @EnvironmentObject var state: AppState
    @StateObject private var sso = SSOAuth()
    @State private var showEID = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Spacer()
                VStack(spacing: 8) {
                    Image(systemName: "shield.checkerboard")
                        .font(.system(size: 56))
                        .foregroundStyle(.blue)
                    Text("Gerege Template")
                        .font(.largeTitle.bold())
                    Text("eID эсвэл Gerege SSO-гоор нэвтэрнэ үү")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                VStack(spacing: 12) {
                    Button {
                        showEID = true
                    } label: {
                        Label("eID-ээр нэвтрэх", systemImage: "person.text.rectangle")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)

                    Button {
                        sso.start { Task { await state.onAuthenticated() } }
                    } label: {
                        HStack {
                            if sso.busy { ProgressView().tint(.primary) }
                            Label("Gerege SSO-гоор нэвтрэх", systemImage: "globe")
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.large)
                    .disabled(sso.busy)

                    if let e = sso.error {
                        Text(e).font(.footnote).foregroundStyle(.red)
                    }
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 40)
            }
            .navigationDestination(isPresented: $showEID) { EIDLoginView() }
        }
    }
}
